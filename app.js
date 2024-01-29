"use strict";

const Homey = require("homey");
const { HomeyAPI } = require('homey-api');
const flowConditions = require('./lib/flows/conditions');
const flowActions = require('./lib/flows/actions');
const { sleep, flattenObj, replaceLast } = require('./lib/helpers');

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
    this.log(`[onInit] ${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

    await this.initSettings();

    this.log("[onInit] - Loaded settings", {...this.appSettings, FOLDERS: 'LOG'});

    this._api = await HomeyAPI.createAppAPI({
        homey: this.homey,
        debug: false
    });

    this.API_DATA = {};

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
      this.debug = false;

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


        if(!('CHECK_ON_STARTUP' in this.appSettings)) {
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

        if(!('ALL_SCREENSAVERS' in this.appSettings)) {
            await this.updateSettings({
                ...this.appSettings,
                ALL_SCREENSAVERS: 0
            });
        }

        await this.updateSettings({
            ...this.appSettings,
            HOMEY_VERSION: this.homey.platformVersion === 2 ? 'Homey2023' : 'Homey2019'
        });
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
          CHECK_ON_STARTUP: false,
          ALL_FLOWS: 0,
          ALL_VARIABLES: 0,
          ALL_SCREENSAVERS: 0,
          ALL_VARIABLES_OBJ: {},
          FOLDERS: [],
          FILTERED_FOLDERS: [],
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
      
      this.log("[updateSettings] - New settings:");
      this.appSettings = settings;
      
      await this.homey.settings.set(_settingsKey, this.appSettings);  

      if(oldSettings && oldSettings.INTERVAL_FLOWS && settings.INTERVAL_ENABLED && settings.INTERVAL_FLOWS) {
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

      this.token_ALL_SCREENSAVERS = await this.homey.flow.createToken("token_ALL_SCREENSAVERS", {
        type: "number",
        title: this.homey.__("settings.all_screensavers")
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
      await this.token_ALL_SCREENSAVERS.setValue(this.appSettings.ALL_SCREENSAVERS);
      await this.token_UNUSED_FLOWS.setValue(this.appSettings.UNUSED_FLOWS.length);
      await this.token_UNUSED_LOGIC.setValue(this.appSettings.UNUSED_LOGIC.length);
  }

  async setHomeyInfo() {
      try {
        const homeyInfo = await this._api.system.getInfo().catch(e => { console.log(e); return ''});

        await this.updateSettings({
            ...this.appSettings,
            HOMEY_ID: homeyInfo.cloudId || ''
        });
      } catch (error) {
        this.error('[setHomeyInfo]', error);
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
        try {
            await this.updateSettings({...this.appSettings, 'FOLDERS': [...new Set(this.API_DATA.FOLDERS)]});
        } catch (error) {
            this.error('[setFolders]', error);
        }
      
    }

    async getApiData() {
        this.log(`[getApiData] Setting API_DATA`);
        await this._api.flow.connect();
        await this._api.flowtoken.connect();
        await sleep(2000);
        
        // Fill all caches
        this.API_DATA.FLOWTOKENS = Object.values(await this._api.flowtoken.getFlowTokens().catch(e => { console.log(e); return {}}));
        this.API_DATA.FLOWS = Object.values(await this._api.flow.getFlows().catch(e => { console.log(e); return {}}));
        this.API_DATA.ADVANCED_FLOWS = Object.values(await this._api.flow.getAdvancedFlows().catch(e => { console.log(e); return {}}));
        this.API_DATA.FOLDERS = Object.values(await this._api.flow.getFlowFolders().catch(e => { console.log(e); return {}}));
        this.API_DATA.SCREENSAVERS = this.appSettings.HOMEY_VERSION === 'Homey2023' ? [] : await this._api.ledring.getScreensavers().catch(e => { console.log(e); return []});
        this.API_DATA.APPS = Object.values(await this._api.apps.getApps().catch(e => { console.log(e); return {}}));
        this.API_DATA.VARIABLES = Object.values(await this._api.logic.getVariables().catch(e => { console.log(e); return {}}));

        this.log(`[getApiData] Setting API_DATA - data length:`, Object.keys(this.API_DATA).length);
    }

    async findFlowDefects(initial = false, force = false) {
        try {

  
          if(!initial || this.appSettings.CHECK_ON_STARTUP) {
            await this.getApiData();
            await this.setFolders();
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
        try {
            const flowArray = this.appSettings[key];

            this.log(`[findFlows] ${key} - FlowArray: `, flowArray);
            let flows = [];

            if(key === 'BROKEN') {
                
                const flowsArray = [...this.API_DATA.FLOWS, ...this.API_DATA.ADVANCED_FLOWS];
                
                try {
                    // Add promises to array
                    for(let i = 0; i < flowsArray.length; i++) {
                        if(await flowsArray[i].isBroken()) {
                            flows.push(flowsArray[i]);
                        }
                    }
                } catch (error) {
                    this.log(`[findFlows] ${key} - Error: `, error);
                }
            } else if(key === 'DISABLED') {
              
                const f = this.API_DATA.FLOWS.filter(flow => !flow.enabled);
                const af = this.API_DATA.ADVANCED_FLOWS.filter(aflow => !aflow.enabled);;

                flows = [...f, ...af];
            } else if(key === 'UNUSED_FLOWS') {
                const allFlows = this.API_DATA.FLOWS;
                const allAFFlows = this.API_DATA.ADVANCED_FLOWS;

                const actions = allFlows.flatMap(f => f.actions.filter(a => a.id.includes('homey:manager:flow:programmatic_trigger')).flatMap(b => b.args.flow.id));
                const AFactions = allAFFlows.flatMap(flow => Object.values(flow.cards).filter(f => f.type === 'action' && f.id.includes('homey:manager:flow:programmatic_trigger')).flatMap(b => b.args.flow.id));
                const triggers = allFlows.filter(f => f.trigger.id.includes('homey:manager:flow:programmatic_trigger') && !actions.includes(f.id) && !AFactions.includes(f.id));
                const AFtriggers = allAFFlows.filter(flow => Object.values(flow.cards).some(f => f.type === 'trigger' && f.id.includes('homey:manager:flow:programmatic_trigger') && !actions.includes(f.id) && !AFactions.includes(f.id)));

                flows = [...triggers, ...AFtriggers];
            }

            flows = flows.filter(f => !this.appSettings.FILTERED_FOLDERS.includes(f.folder)).map((f) => {
                const folder = this.appSettings.FOLDERS.find(t => t.id === f.folder);
                const folderName = folder ? folder.name : null;

                return {name: f.name, id: f.id, folder: folderName };
            });

            await this.updateSettings({...this.appSettings, [key]: [...new Set(flows)]});
            await this[`token_${key}`].setValue(flows.length);
            await this.checkFlowDiff(key, flows, flowArray);
        } catch (error) {
            this.error('[findFlows]', error);
        }
    }

    async findLogic(key) {
        try {
            const flowArray = this.appSettings[key];
            const flowTokens = this.API_DATA.FLOWTOKENS;
            const screensavers = this.API_DATA.SCREENSAVERS;

            this.ALL_VARIABLES = 0;
            this.ALL_VARIABLES_OBJ = { logic: 0, device: 0, app: 0, bl: 0, fu: 0, screensavers: 0 };
            this.LOGIC_VARIABLES = [];

            this.log(`[findLogic] ${key} - flowArray: `, flowArray);

            const homeyVariables = flowTokens.filter(f => f.id.includes(`homey:manager:logic`)).map(f => `homey:manager:logic|${f.id.split('homey:manager:logic:')[1]}`);
            this.log(`[findLogic] ${key} - homeyVariables: `, homeyVariables, homeyVariables.length);
            
            const homeyDevices = flowTokens.filter(f => f.id.includes(`homey:device`)).map(f => `${replaceLast(f.id, ':', '|')}`);
            this.log(`[findLogic] ${key} - homeyDevices: `, homeyDevices, homeyDevices.length);

            const homeyScreensavers = screensavers.map(f => f.id);
            this.log(`[findLogic] ${key} - homeyScreensavers: `, homeyScreensavers, homeyScreensavers.length);


            let homeyApps = this.API_DATA.APPS.filter(app => app.enabled && !app.crashed).map((f) => (`homey:app:${f.id}`));

            // -------------APP SPECIFIC -----------------------
            let betterLogic = [];
            let flowUtils = [];
            
            if(homeyApps.includes(`homey:app:${externalAppKeyBL}`)) {
                betterLogic = await this._api.apps.getAppSetting({ name: 'variables', id: externalAppKeyBL}).catch(e => { console.log(e); return []});
                
                if(this.debug) {
                    this.log(`[findLogic] ${key} - betterLogic: `, betterLogic);
                }

                betterLogic = betterLogic && betterLogic.length ? betterLogic.map((f) => (`homey:app:${externalAppKeyBL}|${f.name}`)) : [];
            }

            if(homeyApps.includes(`homey:app:${externalAppKeyFU}`)) {
                const flowUtilsSettings = await this._api.apps.getAppSetting({ name: `${externalAppKeyFU}.settings`, id: externalAppKeyFU}).catch(e => { console.log(e); return []});;
                flowUtils = flowTokens.filter(f => f.id.includes(`homey:app:${externalAppKeyFU}`)).map(f => `${replaceLast(f.id, ':', '|')}`);
                flowUtils = flowUtilsSettings ? [...flowUtilsSettings.VARIABLES, ...flowUtils] : flowUtils;
                
                if(this.debug) {
                    this.log(`[findLogic] ${key} - Flow Utils: `, flowUtils);
                }
            }

            const logicMessages = [];
            const flows = [...this.API_DATA.FLOWS, ...this.API_DATA.ADVANCED_FLOWS]

            let filteredFlows = flows.filter(flow =>  {
                let logicVariables = [];
                let deviceVariables = [];
                let appVariables = [];
                let blVariables = [];
                let fuVariables = [];
                let screensaverVariables = [];
                let cards = []

                if(flow.cards) {
                    cards = Object.values(flow.cards);
                } else {
                    const { trigger, conditions, actions } = flow;
                    cards = [trigger, ...conditions, ...actions];
                }

                cards.forEach(f => {
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
                        if(f.id && f.id.includes('homey:manager:logic') && f.args.variable && f.args.variable.id) {
                            logicVariables.push(`homey:manager:logic|${f.args.variable.id}`);
                        } else if(f.ownerUri && f.ownerUri === 'homey:manager:logic' && f.args.variable && f.args.variable.id) {
                            logicVariables.push(`homey:manager:logic|${f.args.variable.id}`);
                        }

                        if(f.id && f.id.includes(`homey:app:${externalAppKeyBL}`) && f.args.variable && f.args.variable.name) {
                            blVariables.push(`homey:app:${externalAppKeyBL}|${f.args.variable.name}`);
                        } else if(f.ownerUri && f.ownerUri === `homey:app:${externalAppKeyBL}` && f.args.variable && f.args.variable.name) {
                            blVariables.push(`homey:app:${externalAppKeyBL}|${f.args.variable.name}`);
                        }

                        if(f.id && f.id.includes(`homey:app:${externalAppKeyFU}`) && f.args.variable && f.args.variable.name) {
                            fuVariables.push(`homey:app:${externalAppKeyFU}|${f.args.variable.name}`);
                        } else if(f.ownerUri && f.ownerUri === `homey:app:${externalAppKeyFU}` && f.args.variable && f.args.variable.name) {
                            fuVariables.push(`homey:app:${externalAppKeyFU}|${f.args.variable.name}`);
                        }

                        if(f.id && f.id.includes('homey:manager:ledring') && f.args.screensaver && f.args.screensaver.uri && f.args.screensaver.uri !== 'homey:manager:ledring') {
                            appVariables.push(`${f.args.screensaver.uri}`);
                        } else if(f.ownerUri && f.ownerUri === 'homey:manager:ledring' && f.args.screensaver && f.args.screensaver.uri && f.args.screensaver.uri !== 'homey:manager:ledring') {
                            appVariables.push(`${f.args.screensaver.uri}`);
                        }

                        if(this.appSettings.HOMEY_VERSION !== 'Homey2023' && f.id && f.id.includes('homey:manager:ledring') && f.args.screensaver && f.args.screensaver.id) {
                            screensaverVariables.push(`${f.args.screensaver.id}`);
                        } else if(this.appSettings.HOMEY_VERSION  !== 'Homey2023' && f.ownerUri && f.ownerUri === 'homey:manager:ledring' && f.args.screensaver && f.args.screensaver.id) {
                            screensaverVariables.push(`${f.args.screensaver.id}`);
                        }

                        let argsArray = f.args && Object.values(f.args) || [];
                        if (!argsArray || !argsArray.length) return false;

                        argsArray = flattenObj(f.args);
        
                        const logicVar = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:manager:logic'));                
                        const logicDevice = argsArray.find(arg => typeof arg === 'string' && arg.includes('homey:device'));
                        const logicApp = argsArray.find(arg =>typeof arg === 'string' && arg.includes('homey:app'));
                        const logicBL = argsArray.find(arg => typeof arg === 'string' && arg.includes(`homey:app:${externalAppKeyBL}`));                    
                        const logicFU = argsArray.find(arg => typeof arg === 'string' && arg.includes(`homey:app:${externalAppKeyFU}`));                    

                        if(logicVar) {
                            const match = logicVar.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                            const varArray = match ? match.filter(l => l.includes('homey:manager:logic')) : [];
                            logicVariables = [...logicVariables, ...varArray];
                        }

                        if(logicDevice) {
                            const match = logicDevice.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                            const varArray = match ? match.filter(l => l.includes('homey:device')) : [];
                            deviceVariables = [...deviceVariables, ...varArray];
                        }
                        
                        if(logicApp) {
                            const match = logicApp.match(/(?<=\[(homey:app:))(.*?)(?=\|)/g);
                            const varArray = match ? match.filter(l => l !== externalAppKeyBL & l !== externalAppKeyFU).map(l => `homey:app:${l}`) : [];
                            appVariables = [...appVariables, ...varArray];
                        }

                        if(logicBL) {
                            const match = logicBL.match(/(?<=\[\[)(.*?)(?=\]\])/g)
                            const varArray = match ? match.filter(l => l.includes(`homey:app:${externalAppKeyBL}`)) : [];
                            blVariables = [...blVariables, ...varArray];
                        } 

                        if(logicFU) {
                            const match = logicFU.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                            const varArray = match ? match .filter(l => l.includes(`homey:app:${externalAppKeyFU}`)): [];
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
                    fu: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.fu + fuVariables.length : fuVariables.length,
                    screensavers: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.screensavers + screensaverVariables.length : screensaverVariables.length
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
                    if(screensaverVariables.length) this.log(`[findLogic] ${key} - screensaverVariables: `, screensaverVariables);
                    this.log(`[findLogic] ---------------------END---------------------------`);
                }
                
                if(logicVariables.length && logicVariables.some((r) => homeyVariables.indexOf(r) === -1)) {
                    logicMessages.push({id: flow.id, msg: 'Logic variable'});
                    return true;
                }
                if(deviceVariables.length && deviceVariables.some((r) => homeyDevices.indexOf(r) === -1)){
                    logicMessages.push({id: flow.id, msg: 'Device variable'});
                    return true;
                }
                if(screensaverVariables.length && screensaverVariables.some((r) => homeyScreensavers.indexOf(r) === -1)) {
                    logicMessages.push({id: flow.id, msg: 'Screensaver missing'});
                    return true;
                }
                if(blVariables.length && blVariables.some((r) => betterLogic.indexOf(r) === -1)) {
                    logicMessages.push({id: flow.id, msg: 'BetterLogic'});
                    return true;
                }
                if(fuVariables.length && fuVariables.some((r) => flowUtils.indexOf(r) === -1)) {
                    logicMessages.push({id: flow.id, msg: 'Flow Utillities'});
                    return true;
                }
                if(appVariables.length && appVariables.some((r) => homeyApps.indexOf(r) === -1)) {
                    logicMessages.push({id: flow.id, msg: 'Broken app'});
                    return true;
                }
                
                return false;
            });
            
            filteredFlows = filteredFlows.map((f) => {
                const folder = this.appSettings.FOLDERS.find(t => t.id === f.folder);
                const logicMessage = logicMessages.find(m => m.id === f.id) || 'Unknown';
                const folderName = folder ? folder.name : 'unknown';

                return {name: f.name, id: f.id, folder: folderName, logicMessage: logicMessage.msg };
            });

            await this.token_ALL_FLOWS.setValue(flows.length);
            await this.token_ALL_SCREENSAVERS.setValue(homeyScreensavers.length);
            await this.token_ALL_VARIABLES.setValue(this.ALL_VARIABLES);

            await this.updateSettings({
                ...this.appSettings, 
                [key]: [...new Set(filteredFlows)], 
                ALL_FLOWS: flows.length, 
                ALL_SCREENSAVERS: homeyScreensavers.length, 
                ALL_VARIABLES: this.ALL_VARIABLES, 
                ALL_VARIABLES_OBJ: this.ALL_VARIABLES_OBJ
            });

            await this[`token_${key}`].setValue(filteredFlows.length);
            await this.checkFlowDiff(key, filteredFlows, flowArray)
        } catch (error) {
            this.error('[findLogic]', error);
        }
    }

    async findUnusedLogic(key) {
        try {
            const logicArray = this.appSettings[key];
            const homeyVariables = this.API_DATA.VARIABLES;
            const logicVariables = this.LOGIC_VARIABLES;

            this.log(`[findUnusedLogic] ${key} - logicArray: `, logicArray);
            let logic = homeyVariables.filter((r) => logicVariables.indexOf(`homey:manager:logic|${r.id}`) === -1);

            logic = logic.map((f) => ({name: f.name, id: f.id}));
        
            if (logicArray.length !== logic.length) {
            await this.updateSettings({...this.appSettings, [key]: [...new Set(logic)]});
            await this[`token_${key}`].setValue(logic.length);
            await this.checkFlowDiff(key, logic, logicArray, true);
            }
        } catch (error) {
            this.error('[findUnusedLogic]', error);
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
            const logicMessage = flow.logicMessage ? flow.logicMessage : false
            await this.setNotification(key, flow.name, flow.folder, 'Flow', logicMessage);

            if(index < 10) {
                const folder = flow.folder ? flow.folder : 'unknown';
                await this.homey.flow.getTriggerCard(`trigger_${key}`).trigger({flow: flow.name, id: flow.id, type: key, folder})
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
                    const folder = flow.folder ? flow.folder : 'unknown';
                    await this.homey.flow.getTriggerCard(`trigger_FIXED`).trigger({flow: flow.name, id: flow.id, type: key, folder})
                        .catch( this.error )
                        .then(this.log(`[flowDiff] FIXED - Triggered: "${flow.name} | ${flow.id}"`)); 
                }
            });
        }
      } catch (error) {
        this.error('[checkFlowDiff]', error);
      }
    }

    async setNotification(key, flow, folderName, type, logicMessage = false) {
      try {
        if(this.appSettings[`NOTIFICATION_${key}`]) {
            const folder = folderName ? `| Folder: **${folderName}**` : '';
            const logicMsg = logicMessage ? `| Reason: **${logicMessage}**` : '';
            await this.homey.notifications.createNotification({
            excerpt: `FlowChecker -  Event: ${key} - ${type}: **${flow}** ${folder} ${logicMsg}`,
            });
        }
      } catch (error) {
        this.error(error);
      }
    }
}

module.exports = App;
