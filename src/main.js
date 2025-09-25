import "./styles/style.scss";
import { MusicListManager } from "./scripts/classes.js";

const musicList = document.getElementById("musicList");
const musicListManager = new MusicListManager(musicList);

musicListManager.checkListState();
