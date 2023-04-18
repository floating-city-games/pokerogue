import BattleScene, { Button } from "../battle-scene";
import PokemonSpecies, { allSpecies } from "../pokemon-species";
import { Species } from "../species";
import { TextStyle, addTextObject } from "../text";
import { Mode } from "./ui";
import * as Utils from "../utils";
import MessageUiHandler from "./message-ui-handler";
import { DexEntryDetails, StarterDexUnlockTree } from "../game-data";
import { Gender, getGenderColor, getGenderSymbol } from "../gender";

export type StarterSelectCallback = (starters: Starter[]) => void;

export interface Starter {
  species: PokemonSpecies;
  shiny: boolean;
  formIndex: integer;
  female: boolean;
}

export default class StarterSelectUiHandler extends MessageUiHandler {
    private starterSelectContainer: Phaser.GameObjects.Container;
    private starterSelectGenIconContainers: Phaser.GameObjects.Container[];
    private pokemonNumberText: Phaser.GameObjects.Text;
    private pokemonSprite: Phaser.GameObjects.Sprite;
    private pokemonNameText: Phaser.GameObjects.Text;
    private pokemonGenderText: Phaser.GameObjects.Text;
    private instructionsText: Phaser.GameObjects.Text;
    private starterSelectMessageBoxContainer: Phaser.GameObjects.Container;

    private genMode: boolean;
    private shinyCursor: integer = 0;
    private formCursor: integer = 0;
    private genderCursor: integer = 0;
    private genCursor: integer = 0;

    private genSpecies: PokemonSpecies[][] = [];
    private lastSpecies: PokemonSpecies;
    private speciesLoaded: Map<Species, boolean> = new Map<Species, boolean>();
    private starterGens: integer[] = [];
    private starterCursors: integer[] = [];
    private starterDetails: [boolean, integer, boolean][] = [];
    private speciesStarterDexEntry: DexEntryDetails;
    private speciesStarterDexTree: StarterDexUnlockTree;
    private canCycleShiny: boolean;
    private canCycleForm: boolean;
    private canCycleGender: boolean;

    private assetLoadCancelled: Utils.BooleanHolder;
    private cursorObj: Phaser.GameObjects.Image;
    private starterCursorObjs: Phaser.GameObjects.Image[];
    private starterIcons: Phaser.GameObjects.Sprite[];
    private genCursorObj: Phaser.GameObjects.Image;
    private genCursorHighlightObj: Phaser.GameObjects.Image;

    private starterSelectCallback: StarterSelectCallback;
  
    constructor(scene: BattleScene) {
      super(scene, Mode.STARTER_SELECT);
    }
  
    setup() {
      const ui = this.getUi();
  
      this.starterSelectContainer = this.scene.add.container(0, -this.scene.game.canvas.height / 6);
      this.starterSelectContainer.setVisible(false);
      ui.add(this.starterSelectContainer);

      const bgColor = this.scene.add.rectangle(0, 0, this.scene.game.canvas.width / 6, this.scene.game.canvas.height / 6, 0x006860);
      bgColor.setOrigin(0, 0);
      this.starterSelectContainer.add(bgColor);

      const starterSelectBg = this.scene.add.image(1, 1, 'starter_select_bg');
      starterSelectBg.setOrigin(0, 0);
      this.starterSelectContainer.add(starterSelectBg);

      this.pokemonNumberText = addTextObject(this.scene, 17, 1, '000', TextStyle.SUMMARY);
      this.pokemonNumberText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonNumberText);

      this.pokemonNameText = addTextObject(this.scene, 6, 112, '', TextStyle.SUMMARY);
      this.pokemonNameText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonNameText);

      this.pokemonGenderText = addTextObject(this.scene, 96, 112, '', TextStyle.SUMMARY);
      this.pokemonGenderText.setOrigin(0, 0);
      this.starterSelectContainer.add(this.pokemonGenderText);

      const genText = addTextObject(this.scene, 115, 6, 'I\nII\nIII\nIV\nV', TextStyle.WINDOW);
      genText.setLineSpacing(16);
      this.starterSelectContainer.add(genText);

      this.starterSelectGenIconContainers = new Array(5).fill(null).map((_, i) => {
        const container = this.scene.add.container(149, 9);
        if (i)
          container.setVisible(false);
        this.starterSelectContainer.add(container);
        return container;
      });

      this.starterCursorObjs = new Array(3).fill(null).map(() => {
        const cursorObj = this.scene.add.image(0, 0, 'starter_select_cursor_highlight');
        cursorObj.setVisible(false);
        cursorObj.setOrigin(0, 0);
        this.starterSelectContainer.add(cursorObj);
        return cursorObj;
      });

      this.cursorObj = this.scene.add.image(0, 0, 'starter_select_cursor');
      this.cursorObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.cursorObj);

      this.genCursorHighlightObj = this.scene.add.image(111, 5, 'starter_select_gen_cursor_highlight');
      this.genCursorHighlightObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.genCursorHighlightObj);

      this.genCursorObj = this.scene.add.image(111, 5, 'starter_select_gen_cursor');
      this.genCursorObj.setVisible(false);
      this.genCursorObj.setOrigin(0, 0);
      this.starterSelectContainer.add(this.genCursorObj);
      
      for (let g = 0; g < this.starterSelectGenIconContainers.length; g++) {
        let s = 0;
        this.genSpecies.push([]);

        for (let species of allSpecies) {
          if (species.getPrevolutionLevels(true).length || species.generation !== g + 1)
            continue;
          this.speciesLoaded.set(species.speciesId, false);
          this.genSpecies[g].push(species);
          const dexEntry = this.scene.gameData.getDefaultDexEntry(species);
          species.generateIconAnim(this.scene, dexEntry?.female, dexEntry?.formIndex);
          const x = (s % 9) * 18;
          const y = Math.floor(s / 9) * 18;
          const icon = this.scene.add.sprite(x, y, species.getIconAtlasKey());
          icon.setScale(0.5);
          icon.setOrigin(0, 0);
          icon.play(species.getIconKey(dexEntry?.female, dexEntry?.formIndex)).stop();
          if (!dexEntry)
            icon.setTintFill(0);
          this.starterSelectGenIconContainers[g].add(icon);
          s++;
        }
      }

      this.scene.anims.create({
        key: 'pkmn_icon__000',
        frames: this.scene.anims.generateFrameNames('pokemon_icons_0', { prefix: `000_`, zeroPad: 2, suffix: '.png', start: 1, end: 34 }),
        frameRate: 128,
        repeat: -1
      });

      this.starterIcons = new Array(3).fill(null).map((_, i) => {
        const icon = this.scene.add.sprite(115, 95 + 16 * i, 'pokemon_icons_0');
        icon.setScale(0.5);
        icon.setOrigin(0, 0);
        icon.play('pkmn_icon__000');
        this.starterSelectContainer.add(icon);
        return icon;
      });

      this.pokemonSprite = this.scene.add.sprite(53, 63, `pkmn__sub`);
      this.starterSelectContainer.add(this.pokemonSprite);

      this.instructionsText = addTextObject(this.scene, 1, 132, '', TextStyle.PARTY);
      this.starterSelectContainer.add(this.instructionsText);

      this.starterSelectMessageBoxContainer = this.scene.add.container(0, this.scene.game.canvas.height / 6);
      this.starterSelectMessageBoxContainer.setVisible(false);
      this.starterSelectContainer.add(this.starterSelectMessageBoxContainer);

      const starterSelectMessageBox = this.scene.add.image(0, 0, 'starter_select_message');
      starterSelectMessageBox.setOrigin(0, 1);
      this.starterSelectMessageBoxContainer.add(starterSelectMessageBox);

      this.message = addTextObject(this.scene, 8, -8, '', TextStyle.WINDOW, { maxLines: 1 });
      this.message.setOrigin(0, 1);
      this.starterSelectMessageBoxContainer.add(this.message);

      this.updateInstructions();
    }
  
    show(args: any[]): void {
      if (args.length >= 1 && args[0] instanceof Function) {
        super.show(args);

        this.starterSelectCallback = args[0] as StarterSelectCallback;

        this.starterSelectContainer.setVisible(true);

        this.setGenMode(false);
        this.setCursor(0);
        this.setGenMode(true);
        this.setCursor(0);
      }
    }

    showText(text: string, delay?: integer, callback?: Function, callbackDelay?: integer, prompt?: boolean, promptDelay?: integer) {
      super.showText(text, delay, callback, callbackDelay, prompt, promptDelay);

      this.starterSelectMessageBoxContainer.setVisible(true);
    }
  
    processInput(button: Button): void {
      const ui = this.getUi();

      let success = false;
  
      if (this.genMode) {
        switch (button) {
          case Button.UP:
            if (this.genCursor)
              success = this.setCursor(this.genCursor - 1);
            break;
          case Button.DOWN:
            if (this.genCursor < 4)
              success = this.setCursor(this.genCursor + 1);
            break;
          case Button.RIGHT:
            success = this.setGenMode(false);
            break;
        }
      } else {
        if (button === Button.ACTION) {
          if (!this.speciesStarterDexEntry)
            ui.playError();
          else if (this.starterCursors.length < 3) {
            let isDupe = false;
            for (let s = 0; s < this.starterCursors.length; s++) {
              if (this.starterGens[s] === this.genCursor && this.starterCursors[s] === this.cursor) {
                isDupe = true;
                break;
              }
            }
            if (!isDupe) {
              const cursorObj = this.starterCursorObjs[this.starterCursors.length];
              cursorObj.setVisible(true);
              cursorObj.setPosition(this.cursorObj.x, this.cursorObj.y);
              const species = this.genSpecies[this.genCursor][this.cursor];
              this.starterIcons[this.starterCursors.length].play(species.getIconKey(this.speciesStarterDexEntry?.female));
              this.starterGens.push(this.genCursor);
              this.starterCursors.push(this.cursor);
              this.starterDetails.push([ !!this.shinyCursor, this.formCursor, !!this.genderCursor ]);
              if (this.speciesLoaded.get(species.speciesId))
                species.cry(this.scene);
              if (this.starterCursors.length === 3) {
                ui.showText('Begin with these POKéMON?', null, () => {
                  ui.setModeWithoutClear(Mode.CONFIRM, () => {
                    ui.setMode(Mode.STARTER_SELECT);
                    const thisObj = this;
                    const originalStarterSelectCallback = this.starterSelectCallback;
                    this.starterSelectCallback = null;
                    originalStarterSelectCallback(new Array(3).fill(0).map(function (_, i) {
                      return {
                        species: thisObj.genSpecies[thisObj.starterGens[i]][thisObj.starterCursors[i]],
                        shiny: thisObj.starterDetails[i][0],
                        formIndex: thisObj.starterDetails[i][1],
                        female: thisObj.starterDetails[i][2]
                      };
                    }));
                  }, () => {
                    ui.setMode(Mode.STARTER_SELECT);
                    this.popStarter();
                    this.clearText();
                  });
                });
              }
              success = true;
              this.updateInstructions();
            } else
              ui.playError();
          }
        } else if (button === Button.CANCEL) {
          if (this.starterCursors.length) {
            this.popStarter();
            success = true;
            this.updateInstructions();
          } else
            ui.playError();
        } else {
          const genStarters = this.starterSelectGenIconContainers[this.genCursor].getAll().length;
          const rows = Math.ceil(genStarters / 9);
          const row = Math.floor(this.cursor / 9);
          switch (button) {
            case Button.CYCLE_SHINY:
              if (this.canCycleShiny) {
                this.setSpeciesDetails(this.lastSpecies, !this.shinyCursor, undefined, undefined);
                if (this.shinyCursor)
                  this.scene.sound.play('sparkle');
                else
                  success = true;
              }
              break;
            case Button.CYCLE_FORM:
              if (this.canCycleForm) {
                this.setSpeciesDetails(this.lastSpecies, undefined, (this.formCursor + 1) % this.lastSpecies.forms.length, undefined);
                success = true;
              }
              break;
            case Button.CYCLE_GENDER:
              if (this.canCycleGender) {
                this.setSpeciesDetails(this.lastSpecies, undefined, undefined, !this.genderCursor);
                success = true;
              }
              break;
            case Button.UP:
              if (row)
                success = this.setCursor(this.cursor - 9);
              break;
            case Button.DOWN:
              if (row < rows - 2 || (row < rows - 1 && this.cursor % 9 <= (genStarters - 1) % 9))
                success = this.setCursor(this.cursor + 9);
              break;
            case Button.LEFT:
              if (this.cursor % 9)
                success = this.setCursor(this.cursor - 1);
              else
                success = this.setGenMode(true);
              break;
            case Button.RIGHT:
              if (this.cursor % 9 < (row < rows - 1 ? 8 : (genStarters - 1) % 9))
                success = this.setCursor(this.cursor + 1);
              break;
          }
        }
      }
    
      if (success)
        ui.playSelect();
    }
    
    updateInstructions(): void {
      let instructionLines = [
        'Arrow Keys/WASD: Move'
      ];
      if (!this.genMode)
        instructionLines.push('A/Space/Enter: Select');
      if (this.starterCursors.length)
        instructionLines.push('X/Backspace/Esc: Undo');
      if (this.speciesStarterDexTree) {
        if (this.canCycleShiny)
          instructionLines.push('R: Cycle Shiny');
       if (this.canCycleForm)
          instructionLines.push('F: Cycle Form');
       if (this.canCycleGender)
          instructionLines.push('G: Cycle Gender');
      }

      if (instructionLines.length >= 4)
        instructionLines[2] += `   ${instructionLines.splice(3, 1)[0]}`;

      this.instructionsText.setText(instructionLines.join('\n'));
    }
  
    setCursor(cursor: integer): boolean {
      let changed = false;

      if (this.genMode) {
        changed = this.genCursor !== cursor;

        if (this.genCursor !== undefined)
          this.starterSelectGenIconContainers[this.genCursor].setVisible(false);
        this.cursor = 0;
        this.genCursor = cursor;
        this.genCursorObj.setY(5 + 17 * this.genCursor);
        this.genCursorHighlightObj.setY(this.genCursorObj.y);
        this.starterSelectGenIconContainers[this.genCursor].setVisible(true);

        for (let s = 0; s < this.starterCursorObjs.length; s++)
          this.starterCursorObjs[s].setVisible(this.starterGens[s] === cursor);
      } else {
        changed = super.setCursor(cursor);

        this.cursorObj.setPosition(148 + 18 * (cursor % 9), 10 + 18 * Math.floor(cursor / 9));

        this.setSpecies(this.genSpecies[this.genCursor][cursor]);

        this.updateInstructions();
      }
  
      return changed;
    }

    setGenMode(genMode: boolean): boolean {
      if (genMode !== this.genMode) {
        this.genMode = genMode;

        this.genCursorObj.setVisible(genMode);
        this.cursorObj.setVisible(!genMode);

        this.setCursor(genMode ? this.genCursor : this.cursor);
        if (genMode)
          this.setSpecies(null);

        return true;
      }

      return false;
    }

    setSpecies(species: PokemonSpecies) {
      this.speciesStarterDexEntry = species ? this.scene.gameData.getDefaultDexEntry(species) : null;
      this.speciesStarterDexTree = this.speciesStarterDexEntry ? this.scene.gameData.getStarterDexUnlockTree(species) : null;

      if (this.lastSpecies) {
        const defaultStarterDexEntry = this.scene.gameData.getDefaultDexEntry(this.lastSpecies);
        const lastSpeciesIcon = (this.starterSelectGenIconContainers[this.lastSpecies.generation - 1].getAt(this.genSpecies[this.lastSpecies.generation - 1].indexOf(this.lastSpecies)) as Phaser.GameObjects.Sprite);
        lastSpeciesIcon.play(this.lastSpecies.getIconKey(!!defaultStarterDexEntry?.female, defaultStarterDexEntry?.formIndex)).stop();
      }

      this.lastSpecies = species;

      if (species && this.speciesStarterDexEntry) {
        this.pokemonNumberText.setText(Utils.padInt(species.speciesId, 3));
        this.pokemonNameText.setText(species.name.toUpperCase());

        this.setSpeciesDetails(species, !!this.speciesStarterDexEntry?.shiny, this.speciesStarterDexEntry?.formIndex || 0, !!this.speciesStarterDexEntry?.female);
      } else {
        this.pokemonNumberText.setText(Utils.padInt(0, 3));
        this.pokemonNameText.setText(species ? '???' : '');

        this.setSpeciesDetails(species, false, 0, false);
      }
    }

    setSpeciesDetails(species: PokemonSpecies, shiny: boolean, formIndex: integer, female: boolean): void {
      if (shiny !== undefined)
        this.shinyCursor = !shiny ? 0 : 1;
      if (formIndex !== undefined)
        this.formCursor = formIndex;
      if (female !== undefined)
        this.genderCursor = !female ? 0 : 1;

      this.pokemonSprite.setVisible(false);

      if (this.assetLoadCancelled) {
        this.assetLoadCancelled.value = true;
        this.assetLoadCancelled = null;
      }

      if (species) {
        const defaultDexEntry = this.scene.gameData.getDefaultDexEntry(species, shiny, formIndex, female) || this.scene.gameData.getDefaultDexEntry(species);
        const dexEntry = this.scene.gameData.getDexEntry(species, !!this.shinyCursor, this.formCursor, !!this.genderCursor);

        if (!dexEntry.caught) {
          if (shiny === undefined || (defaultDexEntry && shiny !== defaultDexEntry.shiny))
            shiny = defaultDexEntry.shiny;
          if (formIndex === undefined || (defaultDexEntry && formIndex !== defaultDexEntry.formIndex))
            formIndex = defaultDexEntry.formIndex || 0;
          if (female === undefined || (defaultDexEntry && female !== defaultDexEntry.female))
            female = defaultDexEntry.female;
        } else {
          shiny = !!this.shinyCursor;
          formIndex = this.formCursor;
          female = !!this.genderCursor;
        }

        if (this.speciesStarterDexTree) {
          const assetLoadCancelled = new Utils.BooleanHolder(false);
          this.assetLoadCancelled = assetLoadCancelled;

          species.loadAssets(this.scene, female, formIndex, shiny, true).then(() => {
            if (assetLoadCancelled.value)
              return;
            this.assetLoadCancelled = null;
            this.speciesLoaded.set(species.speciesId, true);
            this.pokemonSprite.play(species.getSpriteKey(female, formIndex, shiny));
            this.pokemonSprite.setVisible(true);
          });

          species.generateIconAnim(this.scene, female, formIndex);
          (this.starterSelectGenIconContainers[this.genCursor].getAt(this.cursor) as Phaser.GameObjects.Sprite).play(species.getIconKey(female, formIndex));

          let count: integer;
          const calcUnlockedCount = (tree: StarterDexUnlockTree, root?: boolean) => {
            if (root)
              count = 0;
            if (!tree.entry) {
              for (let key of tree[tree.key].keys())
                calcUnlockedCount(tree[tree.key].get(key));
            } else if (tree.entry.caught)
              count++;
          };

          let tree = this.speciesStarterDexTree;

          calcUnlockedCount(tree, true);
          this.canCycleShiny = count > 1;
          tree = (tree.shiny as Map<boolean, StarterDexUnlockTree>).get(!!this.shinyCursor);

          if (this.lastSpecies.forms?.length) {
            calcUnlockedCount(tree, true);
            this.canCycleForm = count > 1;
            tree = (tree.formIndex as Map<integer, StarterDexUnlockTree>).get(this.formCursor);
          } else
            this.canCycleForm = false;

          if (this.lastSpecies.malePercent !== null) {
            calcUnlockedCount(tree, true);
            this.canCycleGender = count > 1;
          } else
            this.canCycleGender = false;
        }

        if (species.malePercent !== null) {
          const gender = !female ? Gender.MALE : Gender.FEMALE;
          this.pokemonGenderText.setText(getGenderSymbol(gender));
          this.pokemonGenderText.setColor(getGenderColor(gender));
          this.pokemonGenderText.setShadowColor(getGenderColor(gender, true));
        } else
          this.pokemonGenderText.setText('');
      } else
        this.pokemonGenderText.setText('');

      this.updateInstructions();
    }

    popStarter(): void {
      this.starterGens.pop();
      this.starterCursors.pop();
      this.starterDetails.pop();
      this.starterCursorObjs[this.starterCursors.length].setVisible(false);
      this.starterIcons[this.starterCursors.length].play('pkmn_icon__000');
    }

    clearText() {
      this.starterSelectMessageBoxContainer.setVisible(false);
      super.clearText();
    }
  
    clear(): void {
      super.clear();
      this.cursor = -1;
      this.starterSelectContainer.setVisible(false);
    }
  }  