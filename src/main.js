import "./styles/style.scss";
import { MusicListManager } from "./scripts/classes.js";
import { parseBlob } from "music-metadata";

const musicList = document.getElementById("musicList");
const musicListManager = new MusicListManager(musicList);
const fileInput = document.getElementById("file-input");

musicListManager.checkListState();

musicList.querySelector("#add-track-btn").addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async (event) => {
  const files = event.target.files;
  if (!files.length) return;

  for (const file of files) {
    try {
      const metadata = await parseBlob(file);

      const title = metadata.common.title || "Title not found";
      const artist = metadata.common.artist || "Artist not found";
      const album = metadata.common.album || "Album not found";

      console.log(`Файл: ${file.name}`);
      console.log(`Title: ${title}, Artist: ${artist}, Album: ${album}`);
    } catch (err) {
      console.error(`Error while reading ${file.name}:`, err);
    }
  }
});
