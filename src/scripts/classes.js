import Button from "../components/Button";
import WaveSurfer from "wavesurfer.js";

export class MusicListManager {
  constructor(listObject, musicStore, fileInput) {
    this.musicList = listObject;
    this.store = musicStore;
    this.fileInput = fileInput;
  }

  async checkListState() {
    const tracks = await this.getSavedTracks();

    if (!tracks.length) {
      this.musicList.innerHTML = `
        <span class="nothing-track-message">
          <span>Nothing here...</span>
          <span>Add a track to your list</span>
          ${Button("Add music", "add-track-btn")}
        </span>
      `;
    } else {
      this.musicList.style.justifyContent = "start";
      this.musicList.style.flexDirection = "column-reverse";

      this.musicList.innerHTML = "";
      await this.renderSavedTracks();

      this.musicList.innerHTML += `
        <span class="track track-btn" id="add-track-btn">Add music +</span>
      `;
    }
  }

  async getSavedTracks() {
    const tracks = [];
    await this.store.iterate((value, key) => {
      tracks.push({ key, ...value });
    });
    return tracks;
  }

  async renderSavedTracks() {
    const tracks = await this.getSavedTracks();

    tracks.forEach((track) => {
      this.musicList.innerHTML += `
        <span data-key="${track.key}" class="track">${track.metadata.title}<br><span class="track-artist">${track.metadata.artist}</span></span>
      `;
    });
  }
}

export class MusicSystemManager {
  constructor(musicStore) {
    this.store = musicStore;
    this.wavesurfer = null;
    this.animationId = null;
    this.coverImage = null;
    this.currentCoverUrl = null;
    this.currentTrackKey = null;
    this.isSeeking = false;
    this.wasPlaying = false;
    this.seekTimeout = null;
    this.tracks = [];
    this.currentTrackIndex = -1;

    // Новые свойства для repeat и volume
    this.isRepeating = false;
    this.isVolumeSliderVisible = false;
    this.volume = 1; // громкость по умолчанию

    // Храним текущий blobUrl чтобы корректно отзывать
    this.currentBlobUrl = null;

    // Элемент с контролами (DOM) — будет устанавливаться в renderControls
    this.musicControls = null;

    // Привязанный обработчик документа (чтобы можно было удалить / переустановить)
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
  }

  // Обработчик клика по документу — использует актуальные элементы из this.musicControls
  _onDocumentClick(e) {
    if (!this.musicControls) return;
    const volumeBtn = this.musicControls.querySelector("#volume-btn");
    const volumeSliderWrapper = this.musicControls.querySelector(
      ".volume-slider-wrapper"
    );

    if (!volumeBtn || !volumeSliderWrapper) return;

    // Если клик вне контейнера кнопки и вне самого слайдера — прячем
    if (
      !volumeBtn.contains(e.target) &&
      !volumeSliderWrapper.contains(e.target)
    ) {
      this.isVolumeSliderVisible = false;
      volumeSliderWrapper.style.display = "none";
      volumeSliderWrapper.classList.remove("visible");
    }
  }

  async renderControls(musicControls, key) {
    // Освобождаем предыдущий cover URL если был
    if (this.currentCoverUrl) {
      try {
        URL.revokeObjectURL(this.currentCoverUrl);
      } catch (err) {
        // логируем для диагностики, чтобы ESLint не ругался на пустой catch
        console.debug("revokeObjectURL error:", err);
      }
      this.currentCoverUrl = null;
    }

    await this.loadTracks();
    this.currentTrackIndex = this.tracks.findIndex(
      (track) => track.key === key
    );

    const track = await this.store.getItem(key);
    if (!track) return;
    this.musicControls = musicControls;
    this.currentTrackKey = key;

    let coverUrl = null;
    if (track.metadata.cover) {
      const blob = new Blob([new Uint8Array(track.metadata.cover.data)], {
        type: track.metadata.cover.format,
      });
      coverUrl = URL.createObjectURL(blob);
      this.currentCoverUrl = coverUrl;
    }

    document.querySelector("body").style.backgroundImage = `url("${
      coverUrl || "./unknownCover.jpg"
    }")`;

    // Используем класс "visible" для управления видимостью и поддерживаем inline-style для обратной совместимости
    this.musicControls.innerHTML = `
      <img src="${coverUrl || "./unknownCover.jpg"}" alt="Cover">
      <div class="track-info">
        <div class="title">${track.metadata.title}</div>
        <div class="artist">${track.metadata.artist}</div>
      </div>
      <div class="waveform-container">
        <div id="waveform" style="width: 100%; height: 80px;"></div>
        <div class="time-display">
          <span id="current-time">0:00</span>
          <span id="duration">0:00</span>
        </div>
      </div>
      <div class="player-controls">
        <button id="repeat-btn" class="${
          this.isRepeating ? "active" : ""
        }"></button>
        <button id="backward-btn"></button>
        <button id="play-pause-btn"></button>
        <button id="forward-btn"></button>
        <div class="volume-container">
          <button id="volume-btn"></button>
          <div class="volume-slider-wrapper ${
            this.isVolumeSliderVisible ? "visible" : ""
          }" style="display: ${this.isVolumeSliderVisible ? "flex" : "none"}">
            <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${
              this.volume
            }">
          </div>
        </div>
      </div>
    `;

    this.coverImage = this.musicControls.querySelector("img");

    // Вызовем setupPlayerControls сразу — без setTimeout
    this.setupPlayerControls();
  }

  async loadTracks() {
    this.tracks = [];
    await this.store.iterate((value, key) => {
      this.tracks.push({ key, ...value });
    });
  }

  setupPlayerControls() {
    const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
    const backwardBtn = this.musicControls.querySelector("#backward-btn");
    const forwardBtn = this.musicControls.querySelector("#forward-btn");
    const repeatBtn = this.musicControls.querySelector("#repeat-btn");
    const volumeBtn = this.musicControls.querySelector("#volume-btn");
    const volumeSlider = this.musicControls.querySelector("#volume-slider");
    const volumeSliderWrapper = this.musicControls.querySelector(
      ".volume-slider-wrapper"
    );
    const currentTimeEl = this.musicControls.querySelector("#current-time");
    const durationEl = this.musicControls.querySelector("#duration");

    if (
      !playPauseBtn ||
      !backwardBtn ||
      !forwardBtn ||
      !repeatBtn ||
      !volumeBtn ||
      !currentTimeEl ||
      !durationEl
    ) {
      return;
    }

    // Иконка play изначально
    playPauseBtn.style.backgroundImage = `url("./playButton.svg")`;

    // Play/pause управляет wavesurfer, если он есть
    playPauseBtn.addEventListener("click", () => {
      if (this.wavesurfer) {
        this.wavesurfer.playPause();
      }
    });

    backwardBtn.addEventListener("click", () => {
      this.playPreviousTrack();
    });

    forwardBtn.addEventListener("click", () => {
      this.playNextTrack();
    });

    // Обработчик для repeat — переключает state и, если есть wavesurfer, применяет
    repeatBtn.addEventListener("click", () => {
      this.isRepeating = !this.isRepeating;

      if (this.isRepeating) {
        repeatBtn.style.backgroundImage = `url("./repeatOn.svg")`;
        repeatBtn.classList.add("active");
      } else {
        repeatBtn.style.backgroundImage = `url("./repeatOff.svg")`;
        repeatBtn.classList.remove("active");
      }

      if (this.wavesurfer) {
        this.wavesurfer.setLoop(this.isRepeating);
      }
    });

    // Обработчик для volume
    volumeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.isVolumeSliderVisible = !this.isVolumeSliderVisible;

      if (volumeSliderWrapper) {
        if (this.isVolumeSliderVisible) {
          volumeSliderWrapper.style.display = "flex";
          volumeSliderWrapper.classList.add("visible");
        } else {
          volumeSliderWrapper.style.display = "none";
          volumeSliderWrapper.classList.remove("visible");
        }
      }
    });

    // Обработчик для ползунка громкости
    if (volumeSlider) {
      volumeSlider.addEventListener("input", (e) => {
        this.volume = parseFloat(e.target.value);
        if (this.wavesurfer) {
          this.wavesurfer.setVolume(this.volume);
        }
      });
    }

    // Удаляем предыдущий обработчик документа (если был), затем вешаем привязанный
    document.removeEventListener("click", this._onDocumentClickBound);
    document.addEventListener("click", this._onDocumentClickBound);

    // IMPORTANT: все слушатели wavesurfer (play/pause/ready/finish/audioprocess)
    // навешиваются теперь **внутри playTrack** на реальный экземпляр wavesurfer.
  }

  playPreviousTrack() {
    if (this.tracks.length === 0) return;

    let previousIndex = this.currentTrackIndex - 1;
    if (previousIndex < 0) {
      previousIndex = this.tracks.length - 1;
    }

    const previousTrack = this.tracks[previousIndex];
    // Сначала отрисуем контролы, затем запустим трек
    this.renderControls(this.musicControls, previousTrack.key);
    this.playTrack(previousTrack.key);
  }

  playNextTrack() {
    if (this.tracks.length === 0) return;

    let nextIndex = this.currentTrackIndex + 1;
    if (nextIndex >= this.tracks.length) {
      nextIndex = 0;
    }

    const nextTrack = this.tracks[nextIndex];
    this.renderControls(this.musicControls, nextTrack.key);
    this.playTrack(nextTrack.key);
  }

  async playTrack(key) {
    const track = await this.store.getItem(key);
    if (!track) return;

    // Удаляем предыдущий плеер и отзываем прошлый blobUrl (если есть)
    if (this.wavesurfer) {
      try {
        this.wavesurfer.destroy();
      } catch (err) {
        console.debug("wavesurfer.destroy error:", err);
      }
      this.stopAnimation();
      if (this.currentBlobUrl) {
        try {
          URL.revokeObjectURL(this.currentBlobUrl);
        } catch (err) {
          console.debug("revokeObjectURL error:", err);
        }
        this.currentBlobUrl = null;
      }
      this.wavesurfer = null;
    }

    // Создаём новый blobUrl и сохраняем его
    const blobUrl = URL.createObjectURL(track.file);
    this.currentBlobUrl = blobUrl;

    // Можно убрать задержку, оставляю минимальную для стабильности
    await new Promise((resolve) => setTimeout(resolve, 50));

    this.wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#ffffff",
      progressColor: "#1db954",
      cursorColor: "#ffffff",
      cursorWidth: 2,
      barWidth: 2,
      barRadius: 3,
      barGap: 2,
      height: 80,
      normalize: true,
      partialRender: true,
      interact: true,
      dragToSeek: true,
    });

    // Навешиваем события на ТОЧНО этот экземпляр
    // play / pause — обновляют UI кнопки
    this.wavesurfer.on("play", () => {
      const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
      if (playPauseBtn)
        playPauseBtn.style.backgroundImage = `url("./pauseButton.svg")`;
      this.startAnimation();
    });

    this.wavesurfer.on("pause", () => {
      const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
      if (playPauseBtn)
        playPauseBtn.style.backgroundImage = `url("./playButton.svg")`;
    });

    // ready — обновляем длительность, громкость и loop, и автозапускаем
    this.wavesurfer.on("ready", () => {
      try {
        this.wavesurfer.setVolume(this.volume);
        this.wavesurfer.setLoop(this.isRepeating);
      } catch (err) {
        console.debug("wavesurfer ready error:", err);
      }

      const duration = this.wavesurfer.getDuration();
      const durationEl = this.musicControls.querySelector("#duration");
      if (durationEl) durationEl.textContent = this.formatTime(duration);

      // Автозапуск
      this.wavesurfer.play();
    });

    // finish — переключаемся на следующий трек, или, если включён repeat, позволяем зацикливаться
    this.wavesurfer.on("finish", () => {
      this.stopAnimation();

      if (this.isRepeating) {
        // Loop обычно сам перезапускает. На всякий случай — небольшой рестарт
        setTimeout(() => {
          if (this.wavesurfer) this.wavesurfer.play();
        }, 50);
        return;
      }

      // Не отзываем blobUrl здесь — сделаем это при создании следующего плеера
      setTimeout(() => {
        this.playNextTrack();
      }, 200);
    });

    // audioprocess — обновление текущего времени
    this.wavesurfer.on("audioprocess", () => {
      if (this.wavesurfer) {
        const currentTime = this.wavesurfer.getCurrentTime();
        const currentTimeEl = this.musicControls.querySelector("#current-time");
        if (currentTimeEl)
          currentTimeEl.textContent = this.formatTime(currentTime);
      }
    });

    this.wavesurfer.on("error", (error) => {
      console.error("WaveSurfer error:", error);
    });

    this.wavesurfer.on("interaction", () => {
      this.wasPlaying = this.wavesurfer.isPlaying();
      this.isSeeking = true;
      // Останавливаем анимацию при начале перемотки
      if (this.coverImage) {
        this.coverImage.style.transform = "scale(1)";
      }
    });

    this.wavesurfer.on("seek", () => {
      this.isSeeking = false;
      // Возобновляем анимацию после завершения перемотки
      if (this.wasPlaying && this.wavesurfer && this.wavesurfer.isPlaying()) {
        this.startAnimation();
      } else if (
        this.wasPlaying &&
        this.wavesurfer &&
        !this.wavesurfer.isPlaying()
      ) {
        setTimeout(() => {
          if (this.wavesurfer) this.wavesurfer.play();
        }, 50);
      }
    });

    // Загружаем аудио
    this.wavesurfer.load(blobUrl);
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  startAnimation() {
    if (!this.coverImage) return;

    // Останавливаем предыдущую анимацию если она есть
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = () => {
      if (!this.wavesurfer || !this.wavesurfer.isPlaying()) {
        if (this.coverImage) {
          this.coverImage.style.transform = "scale(1)";
        }
        this.animationId = requestAnimationFrame(animate);
        return;
      }

      try {
        const peaks = this.wavesurfer.getDecodedData();
        if (!peaks) {
          this.animationId = requestAnimationFrame(animate);
          return;
        }

        const currentTime = this.wavesurfer.getCurrentTime();
        const duration = this.wavesurfer.getDuration();

        if (duration === 0) {
          this.animationId = requestAnimationFrame(animate);
          return;
        }

        const progress = currentTime / duration;
        const channelData = peaks.getChannelData(0);
        const index = Math.floor(progress * channelData.length);
        const amplitude = Math.abs(channelData[index] || 0);
        const scale = 0.9 + amplitude * 0.6;

        this.coverImage.style.transform = `scale(${scale})`;
      } catch (error) {
        console.error("Animation error:", error);
      }

      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.coverImage) {
      this.coverImage.style.transform = "scale(1)";
    }

    if (this.seekTimeout) {
      clearTimeout(this.seekTimeout);
      this.seekTimeout = null;
    }
  }

  stopTrack() {
    if (this.wavesurfer) {
      try {
        this.wavesurfer.stop();
      } catch (err) {
        console.debug("wavesurfer.stop error:", err);
      }
      this.stopAnimation();

      const currentTimeEl = this.musicControls.querySelector("#current-time");
      if (currentTimeEl) {
        currentTimeEl.textContent = "0:00";
      }

      const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
      if (playPauseBtn) {
        playPauseBtn.style.backgroundImage = `url("./playButton.svg")`;
      }
    }
  }
}
