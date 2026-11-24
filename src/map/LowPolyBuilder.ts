import * as THREE from 'three';

/**
 * Authentic, grounded historical medieval color palette.
 * Inspired by natural pigments: lime wash, weathered oak, kiln-fired clay, and vegetable dyes.
 */
export class LowPolyPalette {
  public static woodDark = new THREE.MeshLambertMaterial({ color: 0x2e1f14 }); // Seasoned dark oak
  public static woodLight = new THREE.MeshLambertMaterial({ color: 0x5e432c }); // Natural timber
  public static woodPlanks = new THREE.MeshLambertMaterial({ color: 0x483423 }); // Weathered boards

  public static stoneDark = new THREE.MeshLambertMaterial({ color: 0x44403a }); // Chiseled foundation
  public static stoneLight = new THREE.MeshLambertMaterial({ color: 0x8c867e }); // Dressed limestone
  public static stoneBase = new THREE.MeshLambertMaterial({ color: 0x666057 }); // Ashlar stone

  public static plasterWhite = new THREE.MeshLambertMaterial({ color: 0xf0eada }); // Aged lime wash
  public static plasterCream = new THREE.MeshLambertMaterial({ color: 0xe0d4be }); // Warm straw plaster

  public static roofTerracotta = new THREE.MeshLambertMaterial({ color: 0x8a3c28 }); // Kiln-fired antique clay
  public static roofBlue = new THREE.MeshLambertMaterial({ color: 0x344b66 }); // Muted woad/slate blue
  public static roofGreen = new THREE.MeshLambertMaterial({ color: 0x3a523d }); // Weathered moss slate
  public static roofSlate = new THREE.MeshLambertMaterial({ color: 0x3b4249 }); // River slate

  public static canvasEcru = new THREE.MeshLambertMaterial({ color: 0xd6cbb8 }); // Unbleached linen
  public static madderRed = new THREE.MeshLambertMaterial({ color: 0x7a2f24 }); // Madder root dye
  public static weldYellow = new THREE.MeshLambertMaterial({ color: 0xb59547 }); // Saffron / weld dye

  public static iron = new THREE.MeshLambertMaterial({ color: 0x242629 });
  public static gold = new THREE.MeshLambertMaterial({ color: 0xc49d3b });
  public static glass = new THREE.MeshLambertMaterial({ color: 0x6e8e9e, transparent: true, opacity: 0.75 });
  public static water = new THREE.MeshLambertMaterial({ color: 0x244c60, transparent: true, opacity: 0.85 });
  public static lanternGlow = new THREE.MeshBasicMaterial({ color: 0xffba4a }); // Candlelight

  public static leafDark = new THREE.MeshLambertMaterial({ color: 0x2a4a22 }); // Evergreen pine
  public static leafLight = new THREE.MeshLambertMaterial({ color: 0x3d662c }); // Summer oak foliage
  public static leafAutumn = new THREE.MeshLambertMaterial({ color: 0x945724 });
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
   * 1. Low-Poly Peasant Cottage
   */
  public static createCottage(roofColor: 'terracotta' | 'slate' | 'green' = 'terracotta'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyCottage';

    const w = 4.2;
    const d = 5.6;
    const h = 2.8;

    // Stone Foundation
    const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.6, d + 0.2), LowPolyPalette.stoneDark);
    base.position.y = 0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Lime Plaster Walls
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), LowPolyPalette.plasterWhite);
    wall.position.y = h / 2 + 0.3;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Timber Corner Beams
    const beamGeo = new THREE.BoxGeometry(0.24, h, 0.24);
    const corners = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ];
    corners.forEach(([cx, cz]) => {
      const beam = new THREE.Mesh(beamGeo, LowPolyPalette.woodDark);
      beam.position.set(cx, h / 2 + 0.3, cz);
      beam.castShadow = true;
      group.add(beam);
    });

    // Timber Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.16, d + 0.05), LowPolyPalette.woodDark);
    belt.position.y = h + 0.3;
    group.add(belt);

    // Wooden Entrance Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.12), LowPolyPalette.woodLight);
    door.position.set(0, 0.9 + 0.3, d / 2 + 0.06);
    door.castShadow = true;
    group.add(door);

    // Windows
    const winGeo = new THREE.BoxGeometry(0.8, 0.8, 0.1);
    const win1 = new THREE.Mesh(winGeo, LowPolyPalette.glass);
    win1.position.set(-1.2, 1.6, d / 2 + 0.06);
    group.add(win1);

    const win2 = new THREE.Mesh(winGeo, LowPolyPalette.glass);
    win2.position.set(1.2, 1.6, d / 2 + 0.06);
    group.add(win2);

    // Roof
    const roofMat = roofColor === 'terracotta'
      ? LowPolyPalette.roofTerracotta
      : roofColor === 'green'
      ? LowPolyPalette.roofGreen
      : LowPolyPalette.roofSlate;

    const roof = this.createGabledRoof(w + 0.8, d + 0.8, 2.2, roofMat);
    roof.position.y = h + 0.3;
    group.add(roof);

    // Chimney
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.0, 0.7), LowPolyPalette.stoneLight);
    chim.position.set(w / 3, h + 1.8, -d / 4);
    chim.castShadow = true;
    group.add(chim);

    return group;
  }

  /**
   * 2. Medium Two-Story Half-Timbered Medieval House
   */
  public static createHouseMedium(roofColor: 'terracotta' | 'green' = 'terracotta'): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyHouseMedium';

    const w = 4.8;
    const d = 6.4;

    // Ground Floor: Stone
    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, d), LowPolyPalette.stoneBase);
    gf.position.y = 1.4;
    gf.castShadow = true;
    gf.receiveShadow = true;
    group.add(gf);

    // Overhang Floor Ledge
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.28, d + 0.6), LowPolyPalette.woodDark);
    ledge.position.y = 2.8;
    ledge.castShadow = true;
    group.add(ledge);

    // Second Floor: Plaster
    const sfW = w + 0.4;
    const sfD = d + 0.4;
    const sf = new THREE.Mesh(new THREE.BoxGeometry(sfW, 2.8, sfD), LowPolyPalette.plasterCream);
    sf.position.y = 2.8 + 1.4;
    sf.castShadow = true;
    sf.receiveShadow = true;
    group.add(sf);

    // Corner Beams
    const beamGeo = new THREE.BoxGeometry(0.2, 2.8, 0.2);
    const corners = [
      [-sfW / 2, -sfD / 2],
      [sfW / 2, -sfD / 2],
      [sfW / 2, sfD / 2],
      [-sfW / 2, sfD / 2],
    ];
    corners.forEach(([cx, cz]) => {
      const beam = new THREE.Mesh(beamGeo, LowPolyPalette.woodDark);
      beam.position.set(cx, 2.8 + 1.4, cz);
      beam.castShadow = true;
      group.add(beam);
    });

    // Roof
    const roofMat = roofColor === 'terracotta' ? LowPolyPalette.roofTerracotta : LowPolyPalette.roofGreen;
    const roof = this.createGabledRoof(sfW + 0.9, sfD + 0.9, 2.8, roofMat);
    roof.position.y = 5.6;
    group.add(roof);

    // Dormer
    const dormerRoof = this.createGabledRoof(1.4, 1.6, 1.0, roofMat);
    dormerRoof.position.set(0, 6.2, 1.2);
    group.add(dormerRoof);
    const dormerWin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), LowPolyPalette.glass);
    dormerWin.position.set(0, 6.2, 2.0);
    group.add(dormerWin);

    // Door & Windows
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.15), LowPolyPalette.woodLight);
    door.position.set(-1.0, 1.0, d / 2 + 0.08);
    door.castShadow = true;
    group.add(door);

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.1), LowPolyPalette.glass);
    win1.position.set(1.1, 1.5, d / 2 + 0.08);
    group.add(win1);

    const sfWin1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.1), LowPolyPalette.glass);
    sfWin1.position.set(-1.1, 4.2, sfD / 2 + 0.08);
    group.add(sfWin1);

    const sfWin2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.1), LowPolyPalette.glass);
    sfWin2.position.set(1.1, 4.2, sfD / 2 + 0.08);
    group.add(sfWin2);

    // Stone Chimney
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.8, 0.8), LowPolyPalette.stoneDark);
    chim.position.set(-1.4, 6.8, -1.8);
    chim.castShadow = true;
    group.add(chim);

    return group;
  }

  /**
   * 3. The Boar & Flagon Village Tavern
   */
  public static createTavern(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyTavern';

    const w = 7.6;
    const d = 9.2;

    // Ground Floor: Heavy Masonry
    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 3.0, d), LowPolyPalette.stoneDark);
    gf.position.y = 1.5;
    gf.castShadow = true;
    gf.receiveShadow = true;
    group.add(gf);

    // Second Floor: Plaster
    const sf = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 2.8, d + 0.4), LowPolyPalette.plasterWhite);
    sf.position.y = 3.0 + 1.4;
    sf.castShadow = true;
    sf.receiveShadow = true;
    group.add(sf);

    // Porch
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 2.4), LowPolyPalette.woodDark);
    porchFloor.position.set(0, 0.15, d / 2 + 1.2);
    porchFloor.receiveShadow = true;
    group.add(porchFloor);

    // Porch Posts
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.8, 6);
    [-w / 2 + 0.4, 0, w / 2 - 0.4].forEach((px) => {
      const post = new THREE.Mesh(postGeo, LowPolyPalette.woodDark);
      post.position.set(px, 1.4, d / 2 + 2.2);
      post.castShadow = true;
      group.add(post);
    });

    // Porch Roof
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.2, 2.6), LowPolyPalette.roofGreen);
    porchRoof.position.set(0, 2.9, d / 2 + 1.3);
    porchRoof.rotation.x = 0.15;
    porchRoof.castShadow = true;
    group.add(porchRoof);

    // Main Roof
    const roof = this.createGabledRoof(w + 1.2, d + 0.8, 3.2, LowPolyPalette.roofGreen);
    roof.position.y = 5.8;
    group.add(roof);

    // Double Door
    const dDoor = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.2), LowPolyPalette.woodLight);
    dDoor.position.set(0, 1.1, d / 2 + 0.1);
    dDoor.castShadow = true;
    group.add(dDoor);

    // Tavern Sign
    const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), LowPolyPalette.iron);
    signPost.position.set(1.5, 2.6, d / 2 + 0.6);
    group.add(signPost);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.08), LowPolyPalette.gold);
    signBoard.position.set(1.5, 2.3, d / 2 + 1.0);
    group.add(signBoard);

    // Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8);
    const barrel1 = new THREE.Mesh(barrelGeo, LowPolyPalette.woodDark);
    barrel1.position.set(-w / 2 + 0.8, 0.45, d / 2 + 1.2);
    barrel1.castShadow = true;
    group.add(barrel1);

    const barrel2 = barrel1.clone();
    barrel2.position.set(-w / 2 + 1.5, 0.45, d / 2 + 1.2);
    group.add(barrel2);

    // Chimneys
    const chim1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), LowPolyPalette.stoneLight);
    chim1.position.set(-w / 3, 7.2, -d / 4);
    chim1.castShadow = true;
    group.add(chim1);

    const chim2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), LowPolyPalette.stoneLight);
    chim2.position.set(w / 3, 7.2, d / 4);
    chim2.castShadow = true;
    group.add(chim2);

    return group;
  }

  /**
   * 4. Grand Town Hall (Royal Blue Slate, Stone Colonnade)
   */
  public static createTownHall(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyTownHall';

    const w = 8.8;
    const d = 11.2;

    // Ground Floor: Ashlar Stone
    const gf = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, d), LowPolyPalette.stoneBase);
    gf.position.y = 1.8;
    gf.castShadow = true;
    gf.receiveShadow = true;
    group.add(gf);

    // Portico Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 3.6, 8);
    [-2.2, -0.75, 0.75, 2.2].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, LowPolyPalette.stoneLight);
      pillar.position.set(px, 1.8, d / 2 + 1.2);
      pillar.castShadow = true;
      group.add(pillar);
    });

    const porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 2.0), LowPolyPalette.stoneLight);
    porticoRoof.position.set(0, 3.6, d / 2 + 1.0);
    porticoRoof.castShadow = true;
    group.add(porticoRoof);

    // Second Floor: Fine Plaster
    const sf = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 3.2, d + 0.4), LowPolyPalette.plasterWhite);
    sf.position.y = 3.6 + 1.6;
    sf.castShadow = true;
    sf.receiveShadow = true;
    group.add(sf);

    // Roof
    const roof = this.createGabledRoof(w + 1.4, d + 0.8, 3.8, LowPolyPalette.roofBlue);
    roof.position.y = 6.8;
    group.add(roof);

    // Clock / Bell Tower
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.0, 5.2, 3.0), LowPolyPalette.stoneLight);
    tower.position.set(0, 9.4, 0);
    tower.castShadow = true;
    group.add(tower);

    // Tower Roof
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.4, 8), LowPolyPalette.roofBlue);
    towerRoof.position.set(0, 13.6, 0);
    towerRoof.castShadow = true;
    group.add(towerRoof);

    // Gold Finial
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), LowPolyPalette.gold);
    finial.position.set(0, 15.5, 0);
    group.add(finial);

    // Entrance
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.2), LowPolyPalette.woodDark);
    door.position.set(0, 1.4, d / 2 + 0.1);
    door.castShadow = true;
    group.add(door);

    // Heraldic Banners
    [-2.2, 2.2].forEach((bx) => {
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.2), LowPolyPalette.roofBlue);
      banner.position.set(bx, 4.2, d / 2 + 0.22);
      group.add(banner);
    });

    return group;
  }

  /**
   * 5. Defensive Watchtower
   */
  public static createWatchTower(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyWatchTower';

    // Stone Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 7.0, 8), LowPolyPalette.stoneDark);
    base.position.y = 3.5;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Observation Deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.4, 8), LowPolyPalette.woodDark);
    deck.position.y = 7.2;
    deck.castShadow = true;
    group.add(deck);

    // Battlements
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 1.1, 8, 1, true), LowPolyPalette.woodPlanks);
    rail.position.y = 7.8;
    rail.castShadow = true;
    group.add(rail);

    // Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.6, 8), LowPolyPalette.roofSlate);
    roof.position.y = 10.4;
    roof.castShadow = true;
    group.add(roof);

    return group;
  }

  /**
   * 6. Market Stall (Natural medieval canvas awning)
   */
  public static createMarketStall(canopyColor: THREE.Material = LowPolyPalette.canvasEcru): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyMarketStall';

    // Wooden Counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.4), LowPolyPalette.woodLight);
    counter.position.y = 0.5;
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // 4 Corner Posts
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
    const postPositions = [
      [-1.2, -0.6],
      [1.2, -0.6],
      [1.2, 0.6],
      [-1.2, 0.6]
    ];
    postPositions.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, LowPolyPalette.woodDark);
      post.position.set(px, 1.3, pz);
      post.castShadow = true;
      group.add(post);
    });

    // Natural Canvas Awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 1.8), canopyColor);
    awning.position.set(0, 2.6, 0);
    awning.rotation.x = 0.18;
    awning.castShadow = true;
    group.add(awning);

    // Crates
    const crateGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const crate1 = new THREE.Mesh(crateGeo, LowPolyPalette.woodDark);
    crate1.position.set(-0.8, 1.2, 0);
    crate1.castShadow = true;
    group.add(crate1);

    const crate2 = new THREE.Mesh(crateGeo, LowPolyPalette.woodDark);
    crate2.position.set(0.6, 1.2, 0.1);
    crate2.castShadow = true;
    group.add(crate2);

    // Candlelight lantern
    const lantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14), LowPolyPalette.lanternGlow);
    lantern.position.set(0, 2.3, 0);
    group.add(lantern);

    return group;
  }

  /**
   * 7. Central Village Well
   */
  public static createCentralWell(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'LowPolyWell';

    // Stone Basin
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 1.0, 8), LowPolyPalette.stoneDark);
    basin.position.y = 0.5;
    basin.castShadow = true;
    basin.receiveShadow = true;
    group.add(basin);

    // Water Surface
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.35, 8), LowPolyPalette.water);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.75;
    group.add(water);

    // Wooden Posts
    const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6);
    const p1 = new THREE.Mesh(postGeo, LowPolyPalette.woodDark);
    p1.position.set(-1.2, 1.5, 0);
    p1.castShadow = true;
    group.add(p1);

    const p2 = p1.clone();
    p2.position.set(1.2, 1.5, 0);
    group.add(p2);

    // Crossbeam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.16), LowPolyPalette.woodDark);
    beam.position.set(0, 2.7, 0);
    beam.castShadow = true;
    group.add(beam);

    // Weathered Clay Roof
    const roof = this.createGabledRoof(2.8, 2.2, 1.2, LowPolyPalette.roofTerracotta);
    roof.position.y = 2.8;
    group.add(roof);

    return group;
  }

  /**
   * 8. Stylized Low-Poly Pine & Oak Trees
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

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.2, 7), LowPolyPalette.leafLight);
      cone2.position.y = 3.9;
      cone2.castShadow = true;
      group.add(cone2);

      const cone3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), LowPolyPalette.leafDark);
      cone3.position.y = 5.0;
      cone3.castShadow = true;
      group.add(cone3);
    } else {
      const leafGeo = new THREE.DodecahedronGeometry(1.6);
      const clump1 = new THREE.Mesh(leafGeo, LowPolyPalette.leafLight);
      clump1.position.set(0, 2.8, 0);
      clump1.castShadow = true;
      group.add(clump1);

      const clump2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3), LowPolyPalette.leafDark);
      clump2.position.set(-0.8, 3.4, 0.5);
      clump2.castShadow = true;
      group.add(clump2);

      const clump3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), LowPolyPalette.leafLight);
      clump3.position.set(0.7, 3.6, -0.4);
      clump3.castShadow = true;
      group.add(clump3);
    }

    return group;
  }

  /**
   * 9. Wooden Perimeter Fence Segment
   */
  public static createFence(): THREE.Group {
    const group = new THREE.Group();
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.08), LowPolyPalette.woodLight);
    rail1.position.y = 0.5;
    rail1.castShadow = true;
    group.add(rail1);

    const rail2 = rail1.clone();
    rail2.position.y = 0.9;
    group.add(rail2);

    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 5);
    const p1 = new THREE.Mesh(postGeo, LowPolyPalette.woodDark);
    p1.position.set(-1.4, 0.6, 0);
    p1.castShadow = true;
    group.add(p1);

    const p2 = p1.clone();
    p2.position.set(1.4, 0.6, 0);
    group.add(p2);

    return group;
  }
}
