import Button from "../components/Button";
export class MusicListManager {
  constructor(listObject) {
    this.musicList = listObject;
  }

  checkListState() {
    if (!this.musicList.querySelector(".track")) {
      this.musicList.innerHTML = `
      <span class="nothing-track-message">
      <span>Nothing here...</span>
      <span>Add a track to your list</span>
      ${Button("Add track", "add-track-btn")}
      </span>
    `;
    } else {
      return;
    }
  }
}
