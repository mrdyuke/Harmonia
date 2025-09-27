import Button from "../components/Button";
// import { Howl } from "howler";
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
      this.renderSavedTracks();
      this.musicList.innerHTML = `
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
    this.currentSound = null;
    this.currentCoverUrl = null;
    this.wavesurfer = null;
    this.animationId = null;
    this.coverImage = null;
  }

  async renderControls(musicControls, key) {
    if (this.currentCoverUrl) {
      URL.revokeObjectURL(this.currentCoverUrl);
    }

    const track = await this.store.getItem(key);
    if (!track) return;
    this.musicControls = musicControls;

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
      <div id="waveform" style="width: 100%; height: 80px; margin-top: 20px;"></div>
    `;

    this.coverImage = this.musicControls.querySelector("img");
  }

  async playTrack(key) {
    const track = await this.store.getItem(key);
    if (!track) return;

    // Останавливаем предыдущее воспроизведение
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.stopAnimation();
    }

    const blobUrl = URL.createObjectURL(track.file);

    // Инициализируем WaveSurfer
    this.wavesurfer = WaveSurfer.create({
      container: "#waveform",
      waveColor: "#ffffff",
      progressColor: "#1db954",
      cursorColor: "transparent",
      barWidth: 2,
      barRadius: 3,
      barGap: 2,
      height: 80,
      normalize: true,
      partialRender: true,
      interact: false, // Отключаем взаимодействие для чистого визуала
    });

    this.wavesurfer.load(blobUrl);

    this.wavesurfer.on("ready", () => {
      this.wavesurfer.play();
      this.startAnimation();
    });

    this.wavesurfer.on("finish", () => {
      URL.revokeObjectURL(blobUrl);
      this.stopAnimation();
      console.log(`${track.metadata.title} закончился`);
    });
  }

  startAnimation() {
    if (!this.coverImage) return;

    const animate = () => {
      if (!this.wavesurfer || this.wavesurfer.isPlaying() === false) {
        this.animationId = requestAnimationFrame(animate);
        return;
      }

      // Получаем текущие данные амплитуды
      const peaks = this.wavesurfer.getDecodedData();
      if (!peaks) {
        this.animationId = requestAnimationFrame(animate);
        return;
      }

      // Получаем текущую позицию воспроизведения
      const currentTime = this.wavesurfer.getCurrentTime();
      const duration = this.wavesurfer.getDuration();
      const progress = currentTime / duration;

      // Берем данные амплитуды для текущей позиции
      const channelData = peaks.getChannelData(0);
      const index = Math.floor(progress * channelData.length);
      const amplitude = Math.abs(channelData[index] || 0);

      // Преобразуем амплитуду в scale (0.95 - 1.05)
      const scale = 0.95 + amplitude * 0.1;

      // Применяем трансформацию
      this.coverImage.style.transform = `scale(${scale})`;

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
  }
}
