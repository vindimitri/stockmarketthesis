export function playAchAfterArrive(delayMs = 1000): void {
  const audio = new Audio("/ach.mp3");
  audio.preload = "auto";
  let played = false;
  const tryPlay = () => {
    if (played) return;
    void audio
      .play()
      .then(() => {
        played = true;
        window.removeEventListener("pointerdown", tryPlay);
        window.removeEventListener("keydown", tryPlay);
      })
      .catch(() => {
        /* Autoplay oft erst nach erstem Klick/Tastendruck */
      });
  };
  window.setTimeout(tryPlay, delayMs);
  window.addEventListener("pointerdown", tryPlay);
  window.addEventListener("keydown", tryPlay);
}
