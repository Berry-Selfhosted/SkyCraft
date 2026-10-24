const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const radio = require('../wwwroot/js/campaign-radio.js');
const campaign = require('../wwwroot/js/campaign-story.js');
const collisions = require('../wwwroot/js/flight-collisions.js');
const glb = name => fs.readFileSync(path.join(root, 'wwwroot/assets/models', name));

test('общая карта холмов и озера — GLB 2.0', () => {
  for (const name of ['hills-lake-world.glb']) {
    const bytes = glb(name);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.ok(bytes.length > 100000);
  }
});
test('радио АИДЫ реагирует на ключевые состояния полёта', () => {
  const chapter=campaign.chapters[0];
  const session=radio.createSession(chapter,'wind');
  const base={mode:'running',level:{checkpoints:[{},{},{}]},flightPhase:'disarmed',battery:100,completed:0,collisionCount:0};
  radio.update(session,base);
  assert.ok(session.log.some(item=>item.text.includes('Опушка')));
  assert.ok(session.log.some(item=>item.text.includes('Порывы')));
  radio.update(session,{...base,flightPhase:'armed'});
  radio.update(session,{...base,flightPhase:'flying',completed:2,battery:40,collisionCount:1});
  assert.ok(session.log.some(item=>item.text.includes('Моторы запущены')));
  assert.ok(session.log.some(item=>item.text.includes('заряда')));
  assert.ok(session.log.some(item=>item.text.includes('контакт')));
});
test('все сюжетные вылеты используют импортированный лес без примитивного мира', () => {
  const levels=source('wwwroot/js/campaign-levels.js');
  const renderer=source('wwwroot/js/three-scene.js');
  const scene=source('wwwroot/js/flight-scene.js');
  assert.match(levels,/terrainModel: "hills-lake-world"/);
  assert.match(levels,/storyLevels/);
  assert.match(source('wwwroot/js/flight-levels.js'),/SkycraftCampaignLevels\?\.storyLevels/);
  assert.match(renderer,/hills-lake-world/);
  assert.doesNotMatch(scene,/drawGround\(/);
  assert.doesNotMatch(levels,/operation-valley|detailModels:/);
});
test('коллизии поддерживают расширенные границы мира', () => {
  const level={boundary:94,frontBoundary:54,backBoundary:-246,obstacles:[]};
  const boxes=collisions.build(level);
  assert.equal(boxes.filter(x=>x.name==='Граница полигона').length,4);
  assert.ok(boxes.some(x=>x.min.z < -245));
});
