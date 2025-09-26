import Button from "../components/Button";
import { Howl } from "howler";

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
      this.currentCoverUrl = coverUrl; // Сохраняем новый URL
    }

    document.querySelector("body").style.backgroundImage = `url("${coverUrl}")`;

    this.musicControls.innerHTML = `
      <img src="${coverUrl || "default-cover.png"}" alt="Cover">
      <div class="track-info">
        <div class="title">${track.metadata.title}</div>
        <div class="artist">${track.metadata.artist}</div>
      </div>
    `;
  }

  async playTrack(key) {
    const track = await this.store.getItem(key);
    if (!track) return;

    if (this.currentSound) {
      this.currentSound.stop();
      this.currentSound = null;
    }

    const blobUrl = URL.createObjectURL(track.file);

    const mimeToFormat = {
      "audio/mpeg": "mp3",
      "audio/ogg": "ogg",
      "audio/wav": "wav",
      "audio/flac": "flac",
    };

    const format = mimeToFormat[track.file.type] || "mp3";

    const sound = new Howl({
      src: [blobUrl],
      format: [format],
      volume: 0.8,
      onend: () => {
        URL.revokeObjectURL(blobUrl);
        this.currentSound = null;
        console.log(`${track.metadata.title} закончился`);
      },
    });

    sound.play();
    this.currentSound = sound;
  }
}
