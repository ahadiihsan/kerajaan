import * as THREE from 'three';

/**
 * Ragnarok Online 1 (Prontera) Aesthetic Color Palette
 * Bright, nostalgic, welcoming anime fantasy tones.
 */
export class LowPolyPalette {
  public static woodDark = new THREE.MeshLambertMaterial({ color: 0x362417 });
  public static woodLight = new THREE.MeshLambertMaterial({ color: 0x6e4f35 });
  public static woodPlanks = new THREE.MeshLambertMaterial({ color: 0x583e28 });

  // Prontera White & Gold Masonry
  public static stoneDark = new THREE.MeshLambertMaterial({ color: 0x524e47 });
  public static stoneLight = new THREE.MeshLambertMaterial({ color: 0x9e978c });
  public static stoneBase = new THREE.MeshLambertMaterial({ color: 0x767066 });
  public static fountainMarble = new THREE.MeshLambertMaterial({ color: 0xded8cc }); // Prontera Fountain

  public static plasterWhite = new THREE.MeshLambertMaterial({ color: 0xf4eee2 });
  public static plasterCream = new THREE.MeshLambertMaterial({ color: 0xe6dbc8 });

  // Prontera Roofs
  public static roofTerracotta = new THREE.MeshLambertMaterial({ color: 0x943d28 });
  public static roofBlue = new THREE.MeshLambertMaterial({ color: 0x2d4f7c });
  public static roofGreen = new THREE.MeshLambertMaterial({ color: 0x3a563e });
  public static roofSlate = new THREE.MeshLambertMaterial({ color: 0x3f464e });

  // Vending Carts & Banners
  public static cartRed = new THREE.MeshLambertMaterial({ color: 0xbd3a2b });
  public static cartBlue = new THREE.MeshLambertMaterial({ color: 0x2b5b8c });
  public static cartYellow = new THREE.MeshLambertMaterial({ color: 0xd4a537 });

  public static iron = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
  public static gold = new THREE.MeshLambertMaterial({ color: 0xe6b83b });
  public static glass = new THREE.MeshLambertMaterial({ color: 0x789cb0, transparent: true, opacity: 0.8 });
  public static water = new THREE.MeshLambertMaterial({ color: 0x2a6080, transparent: true, opacity: 0.88 });
  public static lanternGlow = new THREE.MeshBasicMaterial({ color: 0xffbe4d });

  public static leafDark = new THREE.MeshLambertMaterial({ color: 0x2d5023 });
  public static leafLight = new THREE.MeshLambertMaterial({ color: 0x437330 });
}

export class LowPolyBuilder {
  private static createGabledRoof(width: number, depth: number, height: number, material: THREE.Material): THREE.Mesh {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(0, height);
    shape.lineTo(width / 2, 0);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: false,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 1. Prontera Central Water Fountain (Iconic RO1 Centerpiece)
   */
  public static createPronteraFountain(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PronteraCentralFountain';

    // Tier 1: Ground Plaza Basin (radius 3.6m)
    const basin1 = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.8, 0.6, 16),
      LowPolyPalette.fountainMarble
    );
    basin1.position.y = 0.3;
    basin1.castShadow = true;
    basin1.receiveShadow = true;
    group.add(basin1);

    const water1 = new THREE.Mesh(new THREE.CircleGeometry(3.4, 16), LowPolyPalette.water);
    water1.rotation.x = -Math.PI / 2;
    water1.position.y = 0.52;
    group.add(water1);

    // Tier 2: Mid Water Bowl (radius 2.0m, Y = 1.4)
    const pillar1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.0, 1.2, 8),
      LowPolyPalette.stoneLight
    );
    pillar1.position.y = 1.0;
    pillar1.castShadow = true;
    group.add(pillar1);

    const basin2 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 1.4, 0.5, 12),
      LowPolyPalette.fountainMarble
    );
    basin2.position.y = 1.6;
    basin2.castShadow = true;
    group.add(basin2);

    const water2 = new THREE.Mesh(new THREE.CircleGeometry(1.8, 12), LowPolyPalette.water);
    water2.rotation.x = -Math.PI / 2;
    water2.position.y = 1.8;
    group.add(water2);

    // Tier 3: Top Monument Spire & Angel Wings
    const pillar2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, 1.5, 8),
      LowPolyPalette.fountainMarble
    );
    pillar2.position.y = 2.4;
    pillar2.castShadow = true;
    group.add(pillar2);

    const spire = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.4, 6),
      LowPolyPalette.gold
    );
    spire.position.y = 3.6;
    spire.castShadow = true;
    group.add(spire);

    // 4 Water Cascade Streams
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.12, 1.2, 4),
        LowPolyPalette.water
      );
      stream.position.set(Math.cos(angle) * 1.6, 1.1, Math.sin(angle) * 1.6);
      group.add(stream);
    }

    return group;
  }

  /**
   * 2. Ragnarok Online Merchant Vending Pushcart (With Shop Sign)
   */
  public static createVendingCart(cartColor: THREE.Material = LowPolyPalette.cartRed, shopTitle: string = 'Cheap Potions'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'RO1VendingCart';

    // Wooden Cart Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.2), LowPolyPalette.woodLight);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);

    // 2 Large Wooden Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const w1 = new THREE.Mesh(wheelGeo, LowPolyPalette.woodDark);
    w1.position.set(-0.9, 0.5, 0);
    w1.castShadow = true;
    group.add(w1);

    const w2 = new THREE.Mesh(wheelGeo, LowPolyPalette.woodDark);
    w2.position.set(0.9, 0.5, 0);
    w2.castShadow = true;
    group.add(w2);

    // Awning Canopy
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4);
    [-0.7, 0.7].forEach((px) => {
      [-0.5, 0.5].forEach((pz) => {
        const post = new THREE.Mesh(postGeo, LowPolyPalette.woodDark);
        post.position.set(px, 1.6, pz);
        group.add(post);
      });
    });

    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.4), cartColor);
    awning.position.set(0, 2.4, 0);
    awning.rotation.x = 0.12;
    awning.castShadow = true;
    group.add(awning);

    // Floating RO1 Vending Signboard above Cart
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // RO1 Blue/Gold Shop Bubble
    ctx.fillStyle = '#1e3799';
    ctx.roundRect(8, 8, 240, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#f6b93b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`🛒 ${shopTitle}`, 128, 38);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sign.position.set(0, 3.2, 0);
    sign.scale.set(2.2, 0.55, 1);
    group.add(sign);

    return group;
  }

  /**
   * 3. Prontera Bavarian Half-Timbered Cottage
   */
  public static createCottage(roofColor: 'terracotta' | 'slate' | 'green' = 'terracotta'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'RO1Cottage';

    const w = 4.4;
    const d = 5.8;
    const h = 2.8;

    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.6, d + 0.2), LowPolyPalette.stoneDark);
    base.position.y = 0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), LowPolyPalette.plasterWhite);
    wall.position.y = h / 2 + 0.3;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Beams
    const beamGeo = new THREE.BoxGeometry(0.24, h, 0.24);
    [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].forEach(([cx, cz]) => {
      const beam = new THREE.Mesh(beamGeo, LowPolyPalette.woodDark);
      beam.position.set(cx, h / 2 + 0.3, cz);
      beam.castShadow = true;
      group.add(beam);
    });

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.12), LowPolyPalette.woodLight);
    door.position.set(0, 0.9 + 0.3, d / 2 + 0.06);
    door.castShadow = true;
    group.add(door);

    const winGeo = new THREE.BoxGeometry(0.8, 0.8, 0.1);
    const win1 = new THREE.Mesh(winGeo, LowPolyPalette.glass);
    win1.position.set(-1.2, 1.6, d / 2 + 0.06);
    group.add(win1);

    const win2 = new THREE.Mesh(winGeo, LowPolyPalette.glass);
    win2.position.set(1.2, 1.6, d / 2 + 0.06);
    group.add(win2);

    const roofMat = roofColor === 'terracotta' ? LowPolyPalette.roofTerracotta : roofColor === 'green' ? LowPolyPalette.roofGreen : LowPolyPalette.roofSlate;
    const roof = this.createGabledRoof(w + 0.8, d + 0.8, 2.4, roofMat);
    roof.position.y = h + 0.3;
    group.add(roof);

    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.7), LowPolyPalette.stoneLight);
    chim.position.set(w / 3, h + 1.8, -d / 4);
    chim.castShadow = true;
    group.add(chim);

    return group;
  }

  /**
   * 4. Medium Two-Story House (Weaponsmith / Inn)
   */
  public static createHouseMedium(roofColor: 'terracotta' | 'green' = 'terracotta'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'RO1HouseMedium';

    const w = 5.0;
    const d = 6.6;

    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), LowPolyPalette.stoneBase);
    gf.position.y = 1.4;
    gf.castShadow = true;
    gf.receiveShadow = true;
    group.add(gf);

    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.28, d + 0.6), LowPolyPalette.woodDark);
    ledge.position.y = 2.8;
    ledge.castShadow = true;
    group.add(ledge);

    const sfW = w + 0.4;
    const sfD = d + 0.4;
    const sf = new THREE.Mesh(new THREE.BoxGeometry(sfW, 2.8, sfD), LowPolyPalette.plasterCream);
    sf.position.y = 2.8 + 1.4;
    sf.castShadow = true;
    sf.receiveShadow = true;
    group.add(sf);

    const roofMat = roofColor === 'terracotta' ? LowPolyPalette.roofTerracotta : LowPolyPalette.roofGreen;
    const roof = this.createGabledRoof(sfW + 0.9, sfD + 0.9, 2.8, roofMat);
    roof.position.y = 5.6;
    group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.15), LowPolyPalette.woodLight);
    door.position.set(-1.0, 1.0, d / 2 + 0.08);
    door.castShadow = true;
    group.add(door);

    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.8, 0.8), LowPolyPalette.stoneDark);
    chim.position.set(-1.4, 6.8, -1.8);
    chim.castShadow = true;
    group.add(chim);

    return group;
  }

  /**
   * 5. The Prontera Pub & Tavern
   */
  public static createTavern(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PronteraTavern';

    const w = 7.6;
    const d = 9.2;

    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, d), LowPolyPalette.stoneDark);
    gf.position.y = 1.5;
    gf.castShadow = true;
    group.add(gf);

    const sf = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 2.8, d + 0.4), LowPolyPalette.plasterWhite);
    sf.position.y = 4.4;
    sf.castShadow = true;
    group.add(sf);

    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 2.4), LowPolyPalette.woodDark);
    porchFloor.position.set(0, 0.15, d / 2 + 1.2);
    group.add(porchFloor);

    const roof = this.createGabledRoof(w + 1.2, d + 0.8, 3.2, LowPolyPalette.roofGreen);
    roof.position.y = 5.8;
    group.add(roof);

    return group;
  }

  /**
   * 6. Grand Prontera Castle / Guild Hall
   */
  public static createTownHall(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'PronteraCastleHall';

    const w = 9.2;
    const d = 11.6;

    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), LowPolyPalette.stoneBase);
    gf.position.y = 1.8;
    gf.castShadow = true;
    group.add(gf);

    const sf = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 3.2, d + 0.4), LowPolyPalette.plasterWhite);
    sf.position.y = 5.2;
    sf.castShadow = true;
    group.add(sf);

    const roof = this.createGabledRoof(w + 1.4, d + 0.8, 3.8, LowPolyPalette.roofBlue);
    roof.position.y = 6.8;
    group.add(roof);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 5.2, 3.0), LowPolyPalette.fountainMarble);
    tower.position.set(0, 9.4, 0);
    tower.castShadow = true;
    group.add(tower);

    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.4, 8), LowPolyPalette.roofBlue);
    towerRoof.position.set(0, 13.6, 0);
    towerRoof.castShadow = true;
    group.add(towerRoof);

    return group;
  }

  /**
   * 7. Prontera Pine & Oak Trees
   */
  public static createTree(type: 'pine' | 'oak' = 'pine', scale: number = 1.0): THREE.Group {
    const group = new THREE.Group();
    group.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.2, 6), LowPolyPalette.woodDark);
    trunk.position.y = 1.1;
    trunk.castShadow = true;
    group.add(trunk);

    if (type === 'pine') {
      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 7), LowPolyPalette.leafDark);
      cone1.position.y = 2.6;
      cone1.castShadow = true;
      group.add(cone1);

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 7), LowPolyPalette.leafLight);
      cone2.position.y = 4.0;
      cone2.castShadow = true;
      group.add(cone2);
    } else {
      const clump = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6), LowPolyPalette.leafLight);
      clump.position.set(0, 2.8, 0);
      clump.castShadow = true;
      group.add(clump);
    }

    return group;
  }
}
