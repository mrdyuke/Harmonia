import "./styles/style.scss";
import localforage from "localforage";
import { MusicListManager } from "./scripts/classes.js";
// import { Howl } from "howler";
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
      await saveTrack(file, metadata);
    } catch (err) {
      console.error(`Error while reading ${file.name}:`, err);
    }
  }
});

const musicStore = localforage.createInstance({
  name: "MusicStore",
});

async function saveTrack(file, metadata) {
  const id = file.name + "_" + file.size;

  const simplifiedMetadata = {
    title: metadata.common.title || file.name,
    artist: metadata.common.artist || "Unknown",
    album: metadata.common.album || "Unknown",
  };

  await musicStore.setItem(id, {
    file,
    metadata: simplifiedMetadata,
  });
  return console.log(`saved: ${simplifiedMetadata.title}`);
}
