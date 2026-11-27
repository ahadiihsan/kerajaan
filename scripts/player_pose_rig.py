import json

from PIL import Image, ImageDraw


BOW = [
    [((195,266),(123,266)),((184,261),(145,251)),((185,261),(146,232)),((193,248),(123,228))],
    [((199,260),(125,263)),((201,247),(156,247)),((211,244),(144,227)),((205,239),(128,225))],
    [((193,244),(134,267)),((207,223),(176,245)),((221,224),(157,228)),((209,234),(154,229))],
    [((202,242),(186,267)),((213,211),(203,237)),((216,198),(166,222)),((218,199),(166,222))],
    [((116,263),(197,266)),((128,223),(211,208)),((128,223),(208,200)),((128,223),(208,208))],
    [((108,242),(127,265)),((103,219),(153,229)),((100,206),(163,220)),((103,214),(194,223))],
    [((124,249),(166,267)),((122,232),(178,238)),((94,224),(192,226)),((114,227),(194,229))],
    [((191,263),(122,260)),((125,242),(183,233)),((108,246),(190,227)),((112,223),(193,233))],
]

SOUTH_BOW = [
    ((173,253),(148,253)),
    ((160,247),(160,228)),
    ((160,244),(160,225)),
    ((160,244),(160,223)),
]

REAR_BOW = [
    [((160,254),(160,254)),((160,219),(160,215)),((160,215),(160,208)),((160,215),(160,207))],
    [((118,271),(153,265)),((98,202),(143,215)),((95,201),(143,211)),((93,208),(143,210))],
]

HANDED_BOW_ROWS = [3,6,7]
HANDED_BOW = [
    [((179,264),(197,261)),((227,207),(190,219)),((236,201),(157,217)),((238,200),(156,216))],
    [((149,262),(125,260)),((104,233),(145,218)),((83,231),(145,217)),((84,231),(180,222))],
    [((158,261),(118,260)),((102,235),(130,221)),((87,238),(147,216)),((86,239),(192,218))],
]
NORTH_BOW = [
    ((114,251),(198,273)),
    ((160,180),(160,180)),
    ((160,174),(160,190)),
    ((160,174),(160,188)),
]

FISH = [
    [((173,260),(149,257)),((149,238),(126,210)),((174,240),(154,238)),((180,254),(160,250)),((183,246),(165,243)),((170,239),(191,218))],
    [((193,257),(166,254)),((158,235),(135,208)),((171,241),(198,230)),((187,251),(208,250)),((177,243),(203,227)),((184,235),(203,218))],
    [((183,255),(201,253)),((164,221),(146,206)),((195,239),(215,232)),((194,250),(214,250)),((190,240),(208,226)),((190,236),(203,215))],
    [((211,255),(194,252)),((153,224),(132,203)),((197,238),(212,227)),((194,246),(209,244)),((191,236),(200,225)),((180,235),(191,216))],
    [((192,251),(210,247)),((142,217),(124,203)),((192,236),(212,226)),((192,248),(212,239)),((188,230),(207,212)),((183,231),(199,212))],
    [((136,259),(126,255)),((141,218),(121,201)),((136,259),(126,255)),((136,259),(126,255)),((136,259),(126,255)),((141,218),(121,201))],
    [((121,247),(102,243)),((129,229),(111,207)),((131,238),(111,234)),((134,238),(114,234)),((137,239),(118,236)),((137,239),(118,236))],
    [((153,245),(120,238)),((145,236),(110,202)),((168,241),(134,238)),((149,246),(124,233)),((149,246),(124,233)),((149,246),(124,233))],
]

WALK_LEFT = [
    [(122,102),(120,105),(121,100),(117,104),(120,103),(121,107),(121,103),(117,104)],
    [(117,100),(121,99),(117,99),(117,98),(117,100),(117,96),(117,96),(118,98)],
    [(110,97),(108,97),(111,93),(115,91),(109,95),(110,95),(109,94),(115,96)],
    [(66,104)]*8, [(60,105)]*8,
    [(65,111),(60,104),(58,95),(56,91),(63,109),(58,108),(60,91),(59,85)],
    [(92,117),(70,100),(64,95),(97,106),(70,105),(78,107),(70,101),(68,92)],
    [(116,112),(111,104),(99,107),(96,98),(122,111),(112,107),(99,101),(104,96)],
]
WALK_RIGHT = [
    [(57,108),(60,113),(62,107),(60,100),(61,107),(59,112),(62,106),(60,100)],
    [(59,114),(56,114),(60,109),(54,99),(59,109),(59,111),(62,108),(59,92)],
    [(70,115),(63,113),(75,111),(90,105),(77,112),(85,112),(90,102),(92,106)],
    [(105,110),(116,109),(121,91),(120,84),(113,107),(116,107),(120,86),(121,89)],
    [(122,109)]*8, [(110,105)]*8, [(65,103)]*8,
    [(54,104),(56,107),(60,92),(61,86),(54,103),(55,108),(61,96),(61,88)],
]


def world_point(point):
    x, y = point
    return [round((x-160)*2.8/320, 4), round((312-y)*2.8/320, 4)]


def grips(left, right):
    return {'left': world_point(left), 'right': world_point(right)}


def export_rig(atlases, clean, destination, clean_points, south_bow, rear_bow, handed_bow, north_bow, right_arm):
    metadata = {}
    for action in ('bow', 'fish', 'chop'):
        result = Image.new('RGBA', (2560, 2560))
        metadata[action] = []
        for row in range(8):
            if action == 'bow':
                sources = [0,2,2,4,4,5,0,0]
                stages = [0,1,1,2,2,3,0,0]
                if row == 5:
                    sources = [2,2,2,4,4,5,2,2]
                    stages = [1,1,1,2,2,3,1,1]
                points = BOW[row]
                source = atlases[action]
                if row == 0:
                    sources = [0,1,1,2,2,3,0,0]
                    stages = sources
                    points = SOUTH_BOW
                    source = south_bow
                if row in (4,5):
                    sources = [0,1,1,2,2,3,0,0]
                    stages = sources
                    points = REAR_BOW[row-4]
                    source = rear_bow
                if row in HANDED_BOW_ROWS:
                    sources = [0,1,1,2,2,3,0,0]
                    stages = sources
                    points = HANDED_BOW[HANDED_BOW_ROWS.index(row)]
                    source = handed_bow
                if row == 4:
                    sources = [0,1,1,2,2,3,0,0]
                    stages = sources
                    points = NORTH_BOW
                    source = north_bow
            elif action == 'fish':
                sources = [0,2,2,3,3,5,6,7]
                stages = [0,1,1,2,2,3,4,5]
                if row == 5:
                    sources = [0,2,2,0,0,0,0,2]
                if row == 6:
                    sources[-1] = 6
                if row == 7:
                    sources = [3,2,2,4,4,6,6,6]
                points = FISH[row]
                source = atlases[action]
            else:
                sources = [0,1,1,1,2,2,3,0]
                if row in (3,5):
                    sources = [3,1,1,1,2,2,3,3]
                stages = sources
                points = clean_points[row]
                source = clean
            poses = []
            for column, (source_column, stage) in enumerate(zip(sources, stages)):
                if source is handed_bow:
                    sx, sy = source_column * 320, HANDED_BOW_ROWS.index(row) * 320
                    cell = source.crop((sx,sy,sx+320,sy+320))
                elif source is north_bow:
                    sx, sy = source_column % 2 * 320, source_column // 2 * 320
                    cell = source.crop((sx,sy,sx+320,sy+320))
                elif source is rear_bow:
                    sx, sy = source_column * 320, (row - 4) * 320
                    cell = source.crop((sx,sy,sx+320,sy+320))
                elif source is south_bow:
                    sx, sy = source_column % 2 * 320, source_column // 2 * 320
                    cell = source.crop((sx,sy,sx+320,sy+320))
                else:
                    cell = source.crop((source_column*320,row*320,(source_column+1)*320,(row+1)*320))
                left, right = points[stage]
                arm_cells = {(6,5): 0, (7,3): 1, (7,4): 2, (7,5): 3}
                if action == 'bow' and (row,column) in arm_cells:
                    index = arm_cells[(row,column)]
                    sx, sy = index % 2 * 320, index // 2 * 320
                    arm = right_arm.crop((sx,sy,sx+320,sy+320))
                    mask = Image.new('L', (320,320))
                    ImageDraw.Draw(mask).polygon([(156,216),(166,207),(183,209),(222,210),(224,239),(194,247),(178,239),(165,227)], fill=255)
                    cell.paste(arm, (0,0), mask)
                if action == 'chop' and stage == 0 and row == 4:
                    cell = atlases['chop'].crop((0,row*320,320,(row+1)*320))
                    left, right = {3:((190,256),(215,265)),4:((116,256),(199,256)),5:((124,261),(102,271))}[row]
                result.alpha_composite(cell, (column*320,row*320))
                poses.append(grips(left,right))
            metadata[action].append(poses)
        result.save(destination/f'rowan-{action}-body.png', optimize=True)
    atlases['idle'].save(destination/'rowan-idle.png', optimize=True)
    metadata['walk'] = []
    for row in range(8):
        poses = []
        for column in range(8):
            def walk_world(point):
                x,y = point
                return [round(((2+x*156/157)/160-0.5)*1.55,4),round((1-(2+y*156/157)/160)*1.55,4)]
            poses.append({'left':walk_world(WALK_LEFT[row][column]),'right':walk_world(WALK_RIGHT[row][column])})
        metadata['walk'].append(poses)
    metadata['idle'] = []
    for row in range(8):
        side = 1 if row in (0,1,2,7) else -1
        metadata['idle'].append([grips((160+side*38,260),(160-side*38,260))]*4)
    (destination/'hand-grips.json').write_text(json.dumps(metadata,indent=2)+'\n')
