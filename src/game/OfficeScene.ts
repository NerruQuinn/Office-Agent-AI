import Phaser from 'phaser';

export class OfficeScene extends Phaser.Scene {
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private hoverNeighborGraphics!: Phaser.GameObjects.Graphics;
  private currentHoverTile: { x: number, y: number } | null = null;

  private tileW = 64;
  private tileH = 32;
  private cols = 12;
  private rows = 12;
  private originY = 80;
  private originX = 0;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  create() {
    this.originX = this.scale.width / 2;

    const graphics = this.add.graphics();
    graphics.setDepth(0);

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const x = this.originX + (col - row) * (this.tileW / 2);
        const y = this.originY + (col + row) * (this.tileH / 2);

        graphics.fillStyle(0xf1f5f9, 1);
        graphics.fillPoints([
          new Phaser.Math.Vector2(x, y),
          new Phaser.Math.Vector2(x + this.tileW / 2, y + this.tileH / 2),
          new Phaser.Math.Vector2(x, y + this.tileH),
          new Phaser.Math.Vector2(x - this.tileW / 2, y + this.tileH / 2),
        ], true);

        graphics.lineStyle(1, 0xcbd5e1, 1);
        graphics.strokePoints([
          new Phaser.Math.Vector2(x, y),
          new Phaser.Math.Vector2(x + this.tileW / 2, y + this.tileH / 2),
          new Phaser.Math.Vector2(x, y + this.tileH),
          new Phaser.Math.Vector2(x - this.tileW / 2, y + this.tileH / 2),
        ], true);
      }
    }

    this.hoverNeighborGraphics = this.add.graphics();
    this.hoverGraphics = this.add.graphics();
    this.hoverNeighborGraphics.setDepth(1);
    this.hoverGraphics.setDepth(2);

    const deskGraphics = this.add.graphics();
    deskGraphics.setDepth(3);

    const deskPositions = [
      { col: 2, row: 2 }, { col: 4, row: 2 },
      { col: 2, row: 5 }, { col: 4, row: 5 },
      { col: 7, row: 2 }, { col: 9, row: 2 },
      { col: 7, row: 5 }, { col: 9, row: 5 },
    ];

    deskPositions.forEach(({ col, row }, index) => {
      const x = this.originX + (col - row) * (this.tileW / 2);
      const y = this.originY + (col + row) * (this.tileH / 2);
      const deskH = 20;

      deskGraphics.fillStyle(0x6366f1, 0.9);
      deskGraphics.fillPoints([
        new Phaser.Math.Vector2(x, y - deskH),
        new Phaser.Math.Vector2(x + this.tileW / 2, y + this.tileH / 2 - deskH),
        new Phaser.Math.Vector2(x, y + this.tileH - deskH),
        new Phaser.Math.Vector2(x - this.tileW / 2, y + this.tileH / 2 - deskH),
      ], true);

      deskGraphics.fillStyle(0x4338ca, 0.9);
      deskGraphics.fillPoints([
        new Phaser.Math.Vector2(x - this.tileW / 2, y + this.tileH / 2 - deskH),
        new Phaser.Math.Vector2(x, y + this.tileH - deskH),
        new Phaser.Math.Vector2(x, y + this.tileH),
        new Phaser.Math.Vector2(x - this.tileW / 2, y + this.tileH / 2),
      ], true);

      deskGraphics.fillStyle(0x4f46e5, 0.9);
      deskGraphics.fillPoints([
        new Phaser.Math.Vector2(x, y + this.tileH - deskH),
        new Phaser.Math.Vector2(x + this.tileW / 2, y + this.tileH / 2 - deskH),
        new Phaser.Math.Vector2(x + this.tileW / 2, y + this.tileH / 2),
        new Phaser.Math.Vector2(x, y + this.tileH),
      ], true);

      deskGraphics.fillStyle(0xffffff, 1);
      deskGraphics.fillCircle(x, y - 28, 8);
      deskGraphics.fillStyle(0x6366f1, 1);
      deskGraphics.fillCircle(x, y - 28, 6);

      const txt = this.add.text(x - 20, y - 50, `Agent ${index + 1}`, {
        fontSize: '9px',
        color: '#475569',
        fontFamily: 'Inter, sans-serif',
      });
      txt.setDepth(4);
    });

    const cam = this.cameras.main;
    cam.centerOn(this.originX, this.originY + 200);

    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      isDragging = true;
      lastX = pointer.x;
      lastY = pointer.y;
    });

    this.input.on('pointerup', () => {
      isDragging = false;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isDragging) {
        const dx = pointer.x - lastX;
        const dy = pointer.y - lastY;
        cam.scrollX -= dx / cam.zoom;
        cam.scrollY -= dy / cam.zoom;
        lastX = pointer.x;
        lastY = pointer.y;
      }
      this.handleTileHover(pointer.worldX, pointer.worldY);
    });

    this.input.on('pointerout', () => {
      this.clearHover();
    });

    this.input.on('wheel', (_p: any, _g: any, _dx: number, deltaY: number) => {
      const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
      cam.zoom = Phaser.Math.Clamp(cam.zoom * zoomFactor, 0.3, 3);
      this.handleTileHover(this.input.activePointer.worldX, this.input.activePointer.worldY);
    });
  }

  private screenToTile(screenX: number, screenY: number): { x: number, y: number } | null {
    const relX = screenX - this.originX;
    const relY = screenY - this.originY;

    const tileX = Math.floor((relX / (this.tileW / 2) + relY / (this.tileH / 2)) / 2);
    const tileY = Math.floor((relY / (this.tileH / 2) - relX / (this.tileW / 2)) / 2);

    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) return null;
    return { x: tileX, y: tileY };
  }

  private tileToScreen(tileX: number, tileY: number): { x: number, y: number } {
    return {
      x: this.originX + (tileX - tileY) * (this.tileW / 2),
      y: this.originY + (tileX + tileY) * (this.tileH / 2)
    };
  }

  private drawTileHighlight(
    graphics: Phaser.GameObjects.Graphics,
    tileX: number,
    tileY: number,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeAlpha: number,
    strokeWidth: number
  ) {
    const pos = this.tileToScreen(tileX, tileY);
    const hw = this.tileW / 2;
    const hh = this.tileH / 2;

    graphics.fillStyle(fillColor, fillAlpha);
    graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);

    graphics.beginPath();
    graphics.moveTo(pos.x, pos.y - hh);
    graphics.lineTo(pos.x + hw, pos.y);
    graphics.lineTo(pos.x, pos.y + hh);
    graphics.lineTo(pos.x - hw, pos.y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private handleTileHover(worldX: number, worldY: number) {
    const tile = this.screenToTile(worldX, worldY);

    if (tile && this.currentHoverTile &&
        tile.x === this.currentHoverTile.x &&
        tile.y === this.currentHoverTile.y) return;

    this.currentHoverTile = tile;
    this.hoverGraphics.clear();
    this.hoverNeighborGraphics.clear();

    if (!tile) return;

    const neighbors = [
      { x: tile.x - 1, y: tile.y },
      { x: tile.x + 1, y: tile.y },
      { x: tile.x, y: tile.y - 1 },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y - 1 },
      { x: tile.x + 1, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y + 1 },
      { x: tile.x + 1, y: tile.y - 1 },
    ];

    neighbors.forEach(n => {
      if (n.x >= 0 && n.x < this.cols && n.y >= 0 && n.y < this.rows) {
        this.drawTileHighlight(
          this.hoverNeighborGraphics,
          n.x, n.y,
          0x6366f1,
          0.08,
          0x6366f1,
          0.15,
          1
        );
      }
    });

    this.drawTileHighlight(
      this.hoverGraphics,
      tile.x, tile.y,
      0x6366f1,
      0.25,
      0x818cf8,
      0.8,
      1.5
    );
  }

  private clearHover() {
    this.hoverGraphics.clear();
    this.hoverNeighborGraphics.clear();
    this.currentHoverTile = null;
  }
}
