import "./styles/style.scss";
import localforage from "localforage";
import { MusicListManager } from "./scripts/classes.js";
// import { Howl } from "howler";
import { parseBlob } from "music-metadata";

const musicStore = localforage.createInstance({
  name: "MusicStore",
});

const musicList = document.getElementById("musicList");
const fileInput = document.getElementById("file-input");
const musicListManager = new MusicListManager(musicList, musicStore, fileInput);

musicListManager.checkListState();

musicList.addEventListener("click", (event) => {
  if (event.target && event.target.id === "add-track-btn") {
    fileInput.click();
  }
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

  window.location.reload();
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

  console.log(`saved: ${simplifiedMetadata.title}`);
}
