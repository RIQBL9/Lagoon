import { unlockAudio } from "../audio/engine";
import { setMusicEnabled } from "../audio/music";
import { playerColor, start, toast } from "./app";
import { C } from "./draw";
import { fromRemote, releaseAll } from "./input";
import { connectTv, rumble } from "./net";
import { avatarFor, clearProfile, setProfile } from "./players";
import { save } from "./save";
import { fit } from "./screen";
import { Boot } from "./scenes/boot";
import { Menu } from "./scenes/menu";

fit();
window.addEventListener("resize", fit);

for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, unlockAudio);

setMusicEnabled(save.music);

connectTv({
  input(msg) {
    if (msg.t !== "profile") return fromRemote(msg);
    const first = setProfile(msg.p, msg.avatar);
    const name = avatarFor(msg.p).name;
    toast(first ? `${name} is Player ${msg.p}` : `${name} updated their look`, playerColor(msg.p));
  },
  peer(p, joined) {
    if (joined) {
      toast(`Player ${p} connected`, playerColor(p));
      rumble(120, p);
    } else {
      releaseAll(p);
      toast(`${avatarFor(p).name} left`, C.soft);
      clearProfile(p);
    }
  },
});

// Canvas text needs the font loaded before the first frame, or it flashes in a fallback.
document.fonts
  .load('800 20px "M PLUS Rounded 1c"')
  .catch(() => {})
  .finally(() => start(new Boot(), () => new Menu()));
