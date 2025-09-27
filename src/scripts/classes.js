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
  }

  async renderControls(musicControls, key) {
    if (this.currentCoverUrl) {
      URL.revokeObjectURL(this.currentCoverUrl);
    }

    // Загружаем все треки и находим индекс текущего
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

    document.querySelector("body").style.backgroundImage = `url("${coverUrl}")`;

    this.musicControls.innerHTML = `
      <img src="${coverUrl || "/public/unknownCover.jpg"}" alt="Cover">
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
        <button id="backward-btn"></button>
        <button id="play-pause-btn"></button>
        <button id="forward-btn"></button>
      </div>
    `;

    this.coverImage = this.musicControls.querySelector("img");

    setTimeout(() => {
      this.setupPlayerControls();
    }, 100);
  }

  async loadTracks() {
    this.tracks = [];
    await this.store.iterate((value, key) => {
      this.tracks.push({ key, ...value });
    });
    // Убираем сортировку по названию - сохраняем порядок как в хранилище
    // Треки будут в том же порядке, что и в UI списке
  }

  setupPlayerControls() {
    const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
    const backwardBtn = this.musicControls.querySelector("#backward-btn");
    const forwardBtn = this.musicControls.querySelector("#forward-btn");
    const currentTimeEl = this.musicControls.querySelector("#current-time");
    const durationEl = this.musicControls.querySelector("#duration");

    if (
      !playPauseBtn ||
      !backwardBtn ||
      !forwardBtn ||
      !currentTimeEl ||
      !durationEl
    ) {
      return;
    }

    playPauseBtn.style.backgroundImage = `url("/public/playButton.svg")`;

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

    if (this.wavesurfer) {
      this.wavesurfer.on("play", () => {
        playPauseBtn.style.backgroundImage = `url("/public/pauseButton.svg")`;
      });

      this.wavesurfer.on("pause", () => {
        playPauseBtn.style.backgroundImage = `url("/public/playButton.svg")`;
      });

      this.wavesurfer.on("finish", () => {
        playPauseBtn.style.backgroundImage = `url("/public/playButton.svg")`;
        // Автоматическое переключение на следующий трек при завершении
        setTimeout(() => {
          this.playNextTrack();
        }, 1000);
      });

      this.wavesurfer.on("audioprocess", () => {
        if (this.wavesurfer) {
          const currentTime = this.wavesurfer.getCurrentTime();
          currentTimeEl.textContent = this.formatTime(currentTime);
        }
      });

      this.wavesurfer.on("ready", () => {
        const duration = this.wavesurfer.getDuration();
        durationEl.textContent = this.formatTime(duration);
      });
    }
  }

  playPreviousTrack() {
    if (this.tracks.length === 0) return;

    let previousIndex = this.currentTrackIndex - 1;
    if (previousIndex < 0) {
      previousIndex = this.tracks.length - 1;
    }

    const previousTrack = this.tracks[previousIndex];
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

    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.stopAnimation();
    }

    const blobUrl = URL.createObjectURL(track.file);
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

    this.wavesurfer.load(blobUrl);

    this.wavesurfer.on("ready", () => {
      this.wavesurfer.play();
      this.startAnimation();

      const duration = this.wavesurfer.getDuration();
      const durationEl = this.musicControls.querySelector("#duration");
      if (durationEl) {
        durationEl.textContent = this.formatTime(duration);
      }
    });

    this.wavesurfer.on("finish", () => {
      URL.revokeObjectURL(blobUrl);
      this.stopAnimation();
    });

    this.wavesurfer.on("error", (error) => {
      console.error("WaveSurfer error:", error);
    });

    this.wavesurfer.on("interaction", () => {
      this.wasPlaying = this.wavesurfer.isPlaying();
      this.isSeeking = true;
    });

    this.wavesurfer.on("seek", () => {
      this.isSeeking = false;
      if (this.wasPlaying && this.wavesurfer && !this.wavesurfer.isPlaying()) {
        setTimeout(() => {
          if (this.wavesurfer) {
            this.wavesurfer.play();
          }
        }, 50);
      }
    });
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  startAnimation() {
    if (!this.coverImage) return;

    const animate = () => {
      if (!this.wavesurfer || !this.wavesurfer.isPlaying() || this.isSeeking) {
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
        const scale = 0.95 + amplitude * 0.1;

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
      this.wavesurfer.stop();
      this.stopAnimation();

      const currentTimeEl = this.musicControls.querySelector("#current-time");
      if (currentTimeEl) {
        currentTimeEl.textContent = "0:00";
      }

      const playPauseBtn = this.musicControls.querySelector("#play-pause-btn");
      if (playPauseBtn) {
        playPauseBtn.style.backgroundImage = `url("/public/playButton.svg")`;
      }
    }
  }
}
