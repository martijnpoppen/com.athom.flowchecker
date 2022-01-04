"use strict";

const Homey = require("homey");
const HomeyAPI = require("athom-api").HomeyAPI;
const flowConditions = require('./lib/flows/conditions');
const flowActions = require('./lib/flows/actions');
const { sleep } = require('./lib/helpers');

const _settingsKey = `${Homey.manifest.id}.settings`;
const externalAppKeyBL = 'net.i-dev.betterlogic';
const externalAppKeyFU = "com.flow.utilities";

class App extends Homey.App {
  log() {
    console.log.bind(this, "[log]").apply(this, arguments);
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  // -------------------- INIT ----------------------

  async onInit() {
    this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

    await this.initSettings();

    this.log("[onInit] - Loaded settings", this.appSettings);

    this._api = await HomeyAPI.forCurrentHomey(this.homey);

    await flowConditions.init(this.homey);
    await flowActions.init(this.homey);

    // Prevent false positives on startup of the app. When rebooting Homey not all flows are 'working'.
    await this.setHomeyInfo();
    await this.createTokens();

    await sleep(15000);
    await this.findFlowDefects(true);
  }

  // -------------------- SETTINGS ----------------------

  async initSettings() {
    try {
      let settingsInitialized = false;
      this.homey.settings.getKeys().forEach((key) => {
        if (key == _settingsKey) {
          settingsInitialized = true;
        }
      });

      this.interval = 0;
      this.debug = true;

      if (settingsInitialized) {
        this.log("[initSettings] - Found settings key", _settingsKey);
        this.appSettings = this.homey.settings.get(_settingsKey);

        if(!('BROKEN_VARIABLE' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                BROKEN_VARIABLE: [],
                NOTIFICATION_BROKEN_VARIABLE: true
              });
        }
        if(!('INTERVAL_FLOWS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                INTERVAL_FLOWS: 3
            });
        }

        if(!('ALL_FLOWS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                ALL_FLOWS: 0,
                ALL_VARIABLES: 0
            });
        }

        if(!('ALL_VARIABLES_OBJ' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                ALL_VARIABLES_OBJ: {}
            });
        }

        if(!('INTERVAL_ENABLED' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                INTERVAL_ENABLED: true
            });
        }

        if(!('UNUSED_FLOWS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                UNUSED_FLOWS: [],
                UNUSED_LOGIC: [],
                NOTIFICATION_UNUSED_FLOWS: false,
                NOTIFICATION_UNUSED_LOGIC: false
              });
        }


        if(!('INTERVAL_ENABLED' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                CHECK_ON_STARTUP: false
            });
        }

        if(!('FOLDERS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                FOLDERS: []
            });
        }

        if(!('FILTERED_FOLDERS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                FILTERED_FOLDERS: []
            });
        }
      } else {
        this.log(`Initializing ${_settingsKey} with defaults`);
        await this.updateSettings({
          BROKEN: [],
          DISABLED: [],
          BROKEN_VARIABLE: [],
          UNUSED_FLOWS: [],
          UNUSED_LOGIC: [],
          NOTIFICATION_BROKEN: true,
          NOTIFICATION_DISABLED: false,
          NOTIFICATION_BROKEN_VARIABLE: true,
          NOTIFICATION_UNUSED_FLOWS: false,
          NOTIFICATION_UNUSED_LOGIC: false,
          INTERVAL_FLOWS: 5,
          INTERVAL_ENABLED: true,
          ALL_FLOWS: 0,
          ALL_VARIABLES: 0,
          ALL_VARIABLES_OBJ: {},
          HOMEY_ID: ''
        });
      }
    } catch (err) {
      this.error(err);
    }
  }

  async updateSettings(settings) {
    try {
      const oldSettings = this.appSettings;
      
      this.log("[updateSettings] - New settings:", settings);
      this.appSettings = settings;
      
      await this.homey.settings.set(_settingsKey, this.appSettings);  

      if(oldSettings.INTERVAL_FLOWS && settings.INTERVAL_ENABLED) {
        this.log("[updateSettings] - Comparing intervals", settings.INTERVAL_FLOWS, oldSettings.INTERVAL_FLOWS);
        if(settings.INTERVAL_FLOWS !== oldSettings.INTERVAL_FLOWS) {
            this.setFindFlowsInterval(true);
        }
      }
    } catch (err) {
      this.error(err);
    }
  }

  async createTokens() {
    this.token_BROKEN = await this.homey.flow.createToken("token_BROKEN", {
        type: "number",
        title: this.homey.__("settings.flows_broken")
      });

      this.token_DISABLED = await this.homey.flow.createToken("token_DISABLED", {
        type: "number",
        title: this.homey.__("settings.flows_disabled")
      });

      this.token_BROKEN_VARIABLE = await this.homey.flow.createToken("token_BROKEN_VARIABLE", {
        type: "number",
        title: this.homey.__("settings.flows_broken_variable")
      });

      this.token_ALL_VARIABLES = await this.homey.flow.createToken("token_ALL_VARIABLES", {
        type: "number",
        title: this.homey.__("settings.all_variables")
      });

      this.token_ALL_FLOWS = await this.homey.flow.createToken("token_ALL_FLOWS", {
        type: "number",
        title: this.homey.__("settings.all_flows")
      });

      this.token_UNUSED_FLOWS = await this.homey.flow.createToken("token_UNUSED_FLOWS", {
        type: "number",
        title: this.homey.__("settings.unused_flows")
      });

      this.token_UNUSED_LOGIC = await this.homey.flow.createToken("token_UNUSED_LOGIC", {
        type: "number",
        title: this.homey.__("settings.unused_logic")
      });

      await this.token_BROKEN.setValue(this.appSettings.BROKEN.length);
      await this.token_DISABLED.setValue(this.appSettings.DISABLED.length);
      await this.token_BROKEN_VARIABLE.setValue(this.appSettings.BROKEN_VARIABLE.length);
      await this.token_ALL_VARIABLES.setValue(this.appSettings.ALL_VARIABLES);
      await this.token_ALL_FLOWS.setValue(this.appSettings.ALL_FLOWS);
      await this.token_UNUSED_FLOWS.setValue(this.appSettings.UNUSED_FLOWS.length);
      await this.token_UNUSED_LOGIC.setValue(this.appSettings.UNUSED_LOGIC.length);
  }

  async setHomeyInfo() {
      try {
        const homeyInfo = await this._api.system.getInfo();
        await this.updateSettings({
            ...this.appSettings,
            HOMEY_ID: homeyInfo.cloudId || ''
        });
      } catch (error) {
        this.error(error);
      }
  }

// -------------------- FUNCTIONS ----------------------

    async setFindFlowsInterval(clear = false) {
      const REFRESH_INTERVAL = 1000 * (this.appSettings.INTERVAL_FLOWS * 60);

      if(clear) {
        this.log(`[onPollInterval] - Clearinterval`);
        this.homey.clearInterval(this.onPollInterval);
      }

      this.log(`[onPollInterval]`, this.appSettings.INTERVAL_FLOWS, REFRESH_INTERVAL);
      this.onPollInterval = this.homey.setInterval(this.findFlowDefects.bind(this), REFRESH_INTERVAL);
    }

    async setFolders() {
        const FOLDERS = Object.values(await this._api.flow.getFlowFolders());
        await this.updateSettings({...this.appSettings, 'FOLDERS': [...new Set(FOLDERS)]});
    }
  
    async findFlowDefects(initial = false, force = false) {
      try {
        await this.setFolders();

        if(!initial || this.appSettings.CHECK_ON_STARTUP) {
            await this.findFlows('BROKEN');
            await this.findFlows('DISABLED');
            await this.findFlows('UNUSED_FLOWS');

            if(force || this.interval % (this.appSettings.INTERVAL_FLOWS * 10) === 0) {
                this.log(`[findFlowDefects] BROKEN_VARIABLE - this.interval: ${this.interval} | force: ${force}`);
                await this.findLogic('BROKEN_VARIABLE');
                await this.findUnusedLogic('UNUSED_LOGIC');
            }
        }

        if(initial && this.appSettings.INTERVAL_ENABLED) {
            await sleep(9000);
            await this.setFindFlowsInterval();
        }

        if(!force) this.interval = this.interval + this.appSettings.INTERVAL_FLOWS;
      } catch (error) {
        this.error(error);
      }
    }

    async findFlows(key) {
        const flowArray = this.appSettings[key];

        this.log(`[findFlows] ${key} - FlowArray: `, flowArray);
        let flows = [];

        if(key === 'BROKEN') {
          flows = Object.values(await this._api.flow.getFlows({ filter: { broken: true } }));
        } else if(key === 'DISABLED') {
          flows = Object.values(await this._api.flow.getFlows({ filter: { enabled: false } }));
        } else if(key === 'UNUSED_FLOWS') {
            const allFlows = Object.values(await this._api.flow.getFlows());
            const triggers = allFlows.flatMap(f => f.actions.filter(a => a.uri === 'homey:manager:flow' && a.id === 'programmatic_trigger').flatMap(a => a.args.flow.id))
            flows = allFlows.filter(f => f.trigger.uri === 'homey:manager:flow' && f.trigger.id === 'programmatic_trigger' && !triggers.includes(f.id))
        }

        flows = flows.filter(f => !this.appSettings.FILTERED_FOLDERS.includes(f.folder)).map((f) => {
            const folder = this.appSettings.FOLDERS.find(t => t.id === f.folder);
            const folderName = folder ? folder.name : null;

            return {name: f.name, id: f.id, folder: folderName };
        });

        await this.updateSettings({...this.appSettings, [key]: [...new Set(flows)]});
        await this[`token_${key}`].setValue(flows.length);
        await this.checkFlowDiff(key, flows, flowArray);
    }

    async findLogic(key) {
        const flowArray = this.appSettings[key];
        const flowTokens = await this._api.flowToken.getFlowTokens();
        
        this.ALL_VARIABLES = 0;
        this.ALL_VARIABLES_OBJ = { logic: 0, device: 0, app: 0, bl: 0, fu: 0 };
        this.LOGIC_VARIABLES = [];

        this.log(`[findLogic] ${key} - flowArray: `, flowArray);

        const homeyVariables = flowTokens.filter(f => f.uri === `homey:manager:logic`).map(f => `${f.uri}|${f.id}`);
        this.log(`[findLogic] ${key} - homeyVariables: `, homeyVariables, homeyVariables.length);
        
        const homeyDevices = flowTokens.filter(f => f.uri.startsWith(`homey:device`)).map(f => `${f.uri}|${f.id}`);
        this.log(`[findLogic] ${key} - homeyDevices: `, homeyDevices, homeyDevices.length);


        let homeyApps = Object.values(await this._api.apps.getApps());
        homeyApps = homeyApps.filter(app => app.enabled && !app.crashed).map((f) => (`homey:app:${f.id}`));

        // -------------APP SPECIFIC -----------------------
        let betterLogic = [];
        let flowUtils = [];
        
        if(homeyApps.includes(`homey:app:${externalAppKeyBL}`)) {
            betterLogic = await this._api.apps.getAppSetting({ name: 'variables', id: externalAppKeyBL});
            
            if(this.debug) {
                this.log(`[findLogic] ${key} - betterLogic: `, betterLogic);
            }

            betterLogic = betterLogic.length ? betterLogic.map((f) => (`homey:app:${externalAppKeyBL}|${f.name}`)) : [];
        }

        if(homeyApps.includes(`homey:app:${externalAppKeyFU}`)) {
            const flowUtilsSettings = await this._api.apps.getAppSetting({ name: `${externalAppKeyFU}.settings`, id: externalAppKeyFU});
            flowUtils = flowTokens.filter(f => f.uri === `homey:app:${externalAppKeyFU}`).map(f => f.id);
            flowUtils = flowUtilsSettings ? [...flowUtilsSettings.VARIABLES, ...flowUtils] : flowUtils;
            
            if(this.debug) {
                this.log(`[findLogic] ${key} - Flow Utils: `, flowUtils);
            }

            flowUtils = flowUtils.length ? flowUtils.map((f) => (`homey:app:${externalAppKeyFU}|${f}`)) : [];
        }

        const flows = Object.values(await this._api.flow.getFlows());
        
        const FILTERED_FOLDERS = ['4b67728b-a2c8-4ac4-a2cf-c1f8ade60459'];

        let filteredFlows = flows.filter(f => !f.broken && !FILTERED_FOLDERS.includes(f.folder)).filter(flow =>  {
            let logicVariables = [];
            let deviceVariables = [];
            let appVariables = [];
            let blVariables = [];
            let fuVariables = [];
            const { trigger, conditions, actions } = flow;


            [trigger, ...conditions, ...actions].forEach(f => {
                if(f.droptoken && f.droptoken.includes('homey:manager:logic')) {
                    logicVariables.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes('homey:device:')) {
                    deviceVariables.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes(`homey:app:${externalAppKeyBL}`)) {
                    blVariables.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes(`homey:app:${externalAppKeyFU}`)) {
                    fuVariables.push(f.droptoken);
                } else if(f.droptoken && f.droptoken.includes('homey:app:')) {
                    appVariables.push(f.droptoken.split('|')[0]);
                }
                
                if(f.args) {
                    if(f.uri && f.uri === 'homey:manager:logic' && f.args.variable && f.args.variable.id) {
                        logicVariables.push(`homey:manager:logic|${f.args.variable.id}`);
                    }

                    if(f.uri && f.uri === `homey:app:${externalAppKeyBL}` && f.args.variable && f.args.variable.name) {
                        blVariables.push(`homey:app:${externalAppKeyBL}|${f.args.variable.name}`);
                    }

                    if(f.uri && f.uri === `homey:app:${externalAppKeyFU}` && f.args.variable && f.args.variable.name) {
                        fuVariables.push(`homey:app:${externalAppKeyFU}|${f.args.variable.name}`);
                    }

                    const argsArray = f.args && Object.values(f.args) || [];
                    if (!argsArray || !argsArray.length) return false;
    
                    const logicVar = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:manager:logic'));                
                    const logicDevice = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:device'));
                    const logicApp = argsArray.find(arg =>typeof arg === 'string' && arg.includes('homey:app'));
                    const logicBL = argsArray.find(arg => typeof arg === 'string' && arg.includes(`homey:app:${externalAppKeyBL}`));                    
                    const logicFU = argsArray.find(arg => typeof arg === 'string' && arg.includes(`homey:app:${externalAppKeyFU}`));                    

                    if(logicVar) {
                        const varArray = logicVar.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes('homey:manager:logic'));
                        logicVariables = [...logicVariables, ...varArray];
                    }

                    if(logicDevice) {
                        const varArray = logicDevice.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes('homey:device'));
                        deviceVariables = [...deviceVariables, ...varArray];
                    }
                    
                    if(logicApp) {
                        const varArray = logicApp.match(/(?<=\[(homey:app:))(.*?)(?=\|)/g).filter(l => l !== externalAppKeyBL).map(l => `homey:app:${l}`);
                        appVariables = [...appVariables, ...varArray];
                    }

                    if(logicBL) {
                        const varArray = logicBL.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes(`homey:app:${externalAppKeyBL}`));
                        blVariables = [...blVariables, ...varArray];
                    } 

                    if(logicFU) {
                        const varArray = logicFU.match(/(?<=\[\[)(.*?)(?=\]\])/g).filter(l => l.includes(`homey:app:${externalAppKeyFU}`));
                        fuVariables = [...fuVariables, ...varArray];
                    } 
                }
            });

            const variablesLength = logicVariables.length+deviceVariables.length+appVariables.length+blVariables.length+fuVariables.length;

            this.ALL_VARIABLES = this.ALL_VARIABLES+variablesLength;
            this.ALL_VARIABLES_OBJ = {
                logic: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.logic + logicVariables.length : logicVariables.length,
                device: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.device + deviceVariables.length : deviceVariables.length,
                app: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.app + appVariables.length : appVariables.length,
                bl: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.bl + blVariables.length : blVariables.length,
                fu: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.fu + fuVariables.length : fuVariables.length
            }
            this.LOGIC_VARIABLES = [...this.LOGIC_VARIABLES, ...logicVariables];

            if(this.debug && variablesLength) {
                this.log(`[findLogic] ---------------------START---------------------------`) 
                this.log(`[findLogic]`, flow.name);
                if(logicVariables.length) this.log(`[findLogic] ${key} - logicVariables: `, logicVariables);
                if(deviceVariables.length) this.log(`[findLogic] ${key} - deviceVariables: `, deviceVariables);
                if(appVariables.length) this.log(`[findLogic] ${key} - appVariables: `, appVariables);
                if(blVariables.length) this.log(`[findLogic] ${key} - blVariables: `, blVariables);
                if(fuVariables.length) this.log(`[findLogic] ${key} - fuVariables: `, fuVariables);
                this.log(`[findLogic] ---------------------END---------------------------`);
            }

            if(logicVariables.length && logicVariables.some((r) => homeyVariables.indexOf(r) === -1)) return true;
            if(deviceVariables.length && deviceVariables.some((r) => homeyDevices.indexOf(r) === -1)) return true;
            if(appVariables.length && appVariables.some((r) => homeyApps.indexOf(r) === -1)) return true;
            if(blVariables.length && blVariables.some((r) => betterLogic.indexOf(r) === -1)) return true;
            if(fuVariables.length && fuVariables.some((r) => flowUtils.indexOf(r) === -1)) return true;
             
            return false;
        });
        
        filteredFlows = filteredFlows.map((f) => {
            const folder = this.appSettings.FOLDERS.find(t => t.id === f.folder);
            const folderName = folder ? folder.name : null;

            return {name: f.name, id: f.id, folder: folderName };
        });

        await this.token_ALL_FLOWS.setValue(flows.length);
        await this.token_ALL_VARIABLES.setValue(this.ALL_VARIABLES);

        await this.updateSettings({
            ...this.appSettings, 
            [key]: [...new Set(filteredFlows)], 
            ALL_FLOWS: flows.length, 
            ALL_VARIABLES: this.ALL_VARIABLES, 
            ALL_VARIABLES_OBJ: this.ALL_VARIABLES_OBJ
        });

        await this[`token_${key}`].setValue(filteredFlows.length);
        await this.checkFlowDiff(key, filteredFlows, flowArray)
    }

    async findUnusedLogic(key) {
        const logicArray = this.appSettings[key];
        const homeyVariables = Object.values(await this._api.logic.getVariables());
        const logicVariables = this.LOGIC_VARIABLES;
        
        this.log(`[findUnusedLogic] ${key} - logicArray: `, logicArray);
        let logic = homeyVariables.filter((r) => logicVariables.indexOf(`homey:manager:logic|${r.id}`) === -1);

        logic = logic.map((f) => ({name: f.name, id: f.id}));
    
        if (logicArray.length !== logic.length) {
          await this.updateSettings({...this.appSettings, [key]: [...new Set(logic)]});
          await this[`token_${key}`].setValue(logic.length);
          await this.checkFlowDiff(key, logic, logicArray, true);
        }
    }

    async checkFlowDiff(key, flows, flowArray, logic = false) {
      try {
        let flowDiff = flows.filter(({ id: id1 }) => !flowArray.some(({ id: id2 }) => id2 === id1));
        let flowDiffReverse = flowArray.filter(({ id: id1 }) => !flows.some(({ id: id2 }) => id2 === id1));

        this.log(`[flowDiff] ${key} - flowDiff: `, flowDiff);
        this.log(`[flowDiff] ${key} - flowDiffReverse: `, flowDiffReverse);
  
        if(flowDiff.length) {
          flowDiff.forEach(async (flow, index) =>  {
            await this.setNotification(key, flow.name, flow.folder, 'Flow');

            if(index < 10) {
                await this.homey.flow.getTriggerCard(`trigger_${key}`).trigger({flow: flow.name, id: flow.id})
                    .catch( this.error )
                    .then(this.log(`[flowDiff] ${key} - Triggered: "${flow.name} | ${flow.id}"`)); 
            }
          });
        }

        if(flowDiffReverse.length && logic) {
            flowDiffReverse.forEach(async logic =>  {
              await this.homey.flow.getTriggerCard(`trigger_FIXED_LOGIC`).trigger({logic: logic.name, id: logic.id})
                  .catch( this.error )
                  .then(this.log(`[flowDiff] FIXED_LOGIC - Triggered: "${logic.name} | ${logic.id}"`)); 
            });
        } else if(flowDiffReverse.length) {
            flowDiffReverse.forEach(async (flow, index) =>  {

                if(index < 10) {
                    await this.homey.flow.getTriggerCard(`trigger_FIXED`).trigger({flow: flow.name, id: flow.id})
                        .catch( this.error )
                        .then(this.log(`[flowDiff] FIXED - Triggered: "${flow.name} | ${flow.id}"`)); 
                }
            });
        }
      } catch (error) {
        this.error(error);
      }
    }

    async setNotification(key, flow, folderName, type) {
      try {
        if(this.appSettings[`NOTIFICATION_${key}`]) {
            const folder = folderName ? `| Folder: **${folderName}**` : '';
            await this.homey.notifications.createNotification({
            excerpt: `FlowChecker -  Event: ${key} - ${type}: **${flow}** ${folder}`,
            });
        }
      } catch (error) {
        this.error(error);
      }
    }
}

module.exports = App;
