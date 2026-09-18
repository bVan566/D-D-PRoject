// Boots the Phaser game once data.js/mapScene.js/battleScene.js have all loaded.
window.addEventListener("DOMContentLoaded", () => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    width: MAP_COLS * TILE,
    height: MAP_ROWS * TILE,
    zoom: 1.5,
    pixelArt: true,
    backgroundColor: "#0e1420",
    scene: [MapScene, BattleScene],
  });
});
