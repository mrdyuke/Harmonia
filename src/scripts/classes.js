import Button from "../components/Button";
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
      <span class="track">${track.metadata.title}<br><span class="track-artist">${track.metadata.artist}</span></span>
    `;
    });
  }
}
