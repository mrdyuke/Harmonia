import "./styles/style.scss";
import localforage from "localforage";
import { MusicListManager } from "./scripts/classes.js";
import { MusicSystemManager } from "./scripts/classes.js";
import { parseBlob } from "music-metadata";

const musicStore = localforage.createInstance({
  name: "MusicStore",
});

const musicList = document.getElementById("musicList");
const fileInput = document.getElementById("file-input");
const musicControls = document.getElementById("musicPlayer");
const musicListManager = new MusicListManager(musicList, musicStore, fileInput);
const musicSystemManager = new MusicSystemManager(musicStore);

musicListManager.checkListState();

musicList.addEventListener("click", (event) => {
  if (event.target && event.target.id === "add-track-btn") {
    fileInput.click();
  }
});

musicList.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (event.target.className === "track") {
    const datasetKey = event.target.dataset.key;
    musicStore.removeItem(datasetKey);
    window.location.reload();
  }
});

musicList.addEventListener("click", (event) => {
  if (event.target.className === "track") {
    const datasetKey = event.target.dataset.key;
    musicSystemManager.renderControls(musicControls, datasetKey);
    musicSystemManager.playTrack(datasetKey);
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

  let coverData = null;
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    const picture = metadata.common.picture[0];
    coverData = {
      data: Array.from(picture.data), // Конвертируем Uint8Array в обычный массив
      format: picture.format,
    };
  }

  const simplifiedMetadata = {
    title: metadata.common.title || file.name,
    artist: metadata.common.artist || "Unknown",
    album: metadata.common.album || "Unknown",
    cover: coverData, // Сохраняем данные обложки, а не URL
  };

  await musicStore.setItem(id, {
    file,
    metadata: simplifiedMetadata,
  });
}
