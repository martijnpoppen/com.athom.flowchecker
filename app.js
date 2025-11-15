"use strict";

const Homey = require("homey");
const { HomeyAPI } = require("homey-api");
const flowConditions = require("./lib/flows/conditions");
const flowActions = require("./lib/flows/actions");
const { sleep, flattenObj, replaceLast, get } = require("./lib/helpers");

const _settingsKey = `${Homey.manifest.id}.settings`;
const externalAppKeyBL = "net.i-dev.betterlogic";
const externalAppKeyFU = "com.flow.utilities";

const FORCE_LOGGING = false;
const FORCE_FLOW = false;
const HP23_CHECK = true;
const VARIABLES_PER_FLOW_CHECK = true;
const MAX_FLOWS_FOR_STATS = 140;

class App extends Homey.App {
  log() {
    if (!FORCE_LOGGING) {
      console.log.bind(this, "[log]").apply(this, arguments);
    }
  }

  error() {
    console.error.bind(this, "[error]").apply(this, arguments);
  }

  // -------------------- INIT ----------------------

  async onInit() {
    this.log(`[onInit] ${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

    await this.initSettings();

    this._api = await HomeyAPI.createAppAPI({
      homey: this.homey,
      debug: false
    });

    this.interval = 0;
    this._isRunning = false;
    this._hp23 = this.homey.platformVersion === 2;

    this.API_DATA = {};

    await flowConditions.init(this.homey);
    await flowActions.init(this.homey);

    // Prevent false positives on startup of the app. When rebooting Homey not all flows are 'working'.
    await this.createTokens();

    this.findFlowDefects(true, true);
  }

  // -------------------- SETTINGS ----------------------

  async initSettings() {
    try {
      let settingsInitialized = false;

      this.homey.settings.getKeys().forEach(async (key) => {
        if (key == _settingsKey) {
          settingsInitialized = true; // Old settings found in Homey settings
        }
      });

      if (settingsInitialized) {
        const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
        if (!("CHECK_BROKEN" in appSettings)) {
          await this.updateSettings({
            CHECK_BROKEN: true,
            CHECK_DISABLED: true,
            CHECK_BROKEN_VARIABLE: true,
            CHECK_UNUSED_FLOWS: true,
            CHECK_UNUSED_LOGIC: true,
            CHECK_FIXED: true,
            CHECK_FIXED_LOGIC: true
          });
        }

        if (!("VARIABLES_PER_FLOW" in appSettings)) {
          await this.updateSettings(
            {
              VARIABLES_PER_FLOW: [],
              FLOW_LOGIC_MAP: []
            },
            false
          );
        }

        if (!("BROKEN_DISABLED" in appSettings)) {
          await this.updateSettings(
            {
              BROKEN_DISABLED: [],
              NOTIFICATION_BROKEN_DISABLED: true,
              CHECK_BROKEN_DISABLED: true
            },
            false
          );
        }

        if (!("NOTIFICATION_FIXED" in appSettings)) {
          await this.updateSettings(
            {
              NOTIFICATION_FIXED: false,
              NOTIFICATION_FIXED_LOGIC: false
            },
            false
          );
        }

        if (!("HOMEY_ID" in appSettings) || appSettings.HOMEY_ID === "") {
          const homeyCloudId = await this.homey.cloud.getHomeyId();
          await this.updateSettings(
            {
              HOMEY_ID: homeyCloudId
            },
            false
          );
        }

        this.log(`[InitSettings] - Loading ${_settingsKey}`);
      } else {
        this.log(`[InitSettings] - Initializing ${_settingsKey} with defaults`);
        await this.updateSettings({
          BROKEN: [],
          BROKEN_DISABLED: [],
          DISABLED: [],
          BROKEN_VARIABLE: [],
          UNUSED_FLOWS: [],
          UNUSED_LOGIC: [],
          NOTIFICATION_BROKEN: true,
          CHECK_BROKEN: true,
          NOTIFICATION_BROKEN_DISABLED: true,
          CHECK_BROKEN_DISABLED: true,
          NOTIFICATION_DISABLED: false,
          CHECK_DISABLED: true,
          NOTIFICATION_BROKEN_VARIABLE: true,
          CHECK_BROKEN_VARIABLE: true,
          NOTIFICATION_UNUSED_FLOWS: false,
          CHECK_UNUSED_FLOWS: true,
          NOTIFICATION_UNUSED_LOGIC: false,
          CHECK_UNUSED_LOGIC: true,
          NOTIFICATION_FIXED: false,
          CHECK_FIXED: true,
          NOTIFICATION_FIXED_LOGIC: false,
          CHECK_FIXED_LOGIC: true,
          INTERVAL_FLOWS: 5,
          INTERVAL_ENABLED: true,
          CHECK_ON_STARTUP: false,
          ALL_FLOWS: 0,
          ALL_VARIABLES: 0,
          ALL_SCREENSAVERS: 0,
          ALL_VARIABLES_OBJ: {},
          VARIABLES_PER_FLOW: [],
          FLOW_LOGIC_MAP: [],
          FOLDERS: [],
          FILTERED_FOLDERS: [],
          HOMEY_ID: ""
        });
      }
    } catch (err) {
      this.error(err);
    }
  }

  async updateSettings(newSettings, checkInterval = true) {
    try {
      if (newSettings == null || typeof newSettings !== "object") {
        throw new Error("Invalid settings object provided to updateSettings");
      }

      const oldSettings = (await this.homey.settings.get(_settingsKey)) || {};
      const updatedSettings = {
        ...oldSettings,
        ...newSettings
      };

      if (FORCE_LOGGING) {
        // console.log("[updateSettings] - settings:", { ...updatedSettings, FOLDERS: get(updatedSettings, "FOLDERS", 0).length, FILTERED_FOLDERS: get(updatedSettings, "FILTERED_FOLDERS", 0).length, BROKEN: get(updatedSettings, "BROKEN", 0).length, BROKEN_DISABLED: get(updatedSettings, "BROKEN_DISABLED", 0).length, DISABLED: get(updatedSettings, "DISABLED", 0).length, BROKEN_VARIABLE: get(updatedSettings, "BROKEN_VARIABLE", 0).length, UNUSED_FLOWS: get(updatedSettings, "UNUSED_FLOWS", 0).length, UNUSED_LOGIC: get(updatedSettings, "UNUSED_LOGIC", 0).length, VARIABLES_PER_FLOW: get(updatedSettings, "VARIABLES_PER_FLOW", 0).length, FLOW_LOGIC_MAP: get(updatedSettings, "FLOW_LOGIC_MAP", 0).length });
      }

      await this.homey.settings.set(_settingsKey, updatedSettings);

      if (checkInterval && oldSettings && oldSettings.INTERVAL_FLOWS && newSettings.INTERVAL_ENABLED && newSettings.INTERVAL_FLOWS) {
        this.log("[updateSettings] - Comparing intervals", newSettings.INTERVAL_FLOWS, oldSettings.INTERVAL_FLOWS);
        if (newSettings.INTERVAL_FLOWS !== oldSettings.INTERVAL_FLOWS) {
          this.setFindFlowsInterval(true, newSettings.INTERVAL_FLOWS);
        }
      }

      return updatedSettings;
    } catch (err) {
      this.error(err);
    }
  }

  async createTokens() {
    const appSettings = (await this.homey.settings.get(_settingsKey)) || {};

    this.token_BROKEN = await this.homey.flow.createToken("token_BROKEN", {
      type: "number",
      title: this.homey.__("settings.flows.broken")
    });

    this.token_BROKEN_DISABLED = await this.homey.flow.createToken("token_BROKEN_DISABLED", {
      type: "number",
      title: this.homey.__("settings.flows.broken_disabled")
    });

    this.token_DISABLED = await this.homey.flow.createToken("token_DISABLED", {
      type: "number",
      title: this.homey.__("settings.flows.disabled")
    });

    this.token_BROKEN_VARIABLE = await this.homey.flow.createToken("token_BROKEN_VARIABLE", {
      type: "number",
      title: this.homey.__("settings.flows.broken_variable")
    });

    this.token_ALL_VARIABLES = await this.homey.flow.createToken("token_ALL_VARIABLES", {
      type: "number",
      title: this.homey.__("settings.all.variables")
    });

    this.token_ALL_FLOWS = await this.homey.flow.createToken("token_ALL_FLOWS", {
      type: "number",
      title: this.homey.__("settings.all.flows")
    });

    this.token_ALL_SCREENSAVERS = await this.homey.flow.createToken("token_ALL_SCREENSAVERS", {
      type: "number",
      title: this.homey.__("settings.all.screensavers")
    });

    this.token_UNUSED_FLOWS = await this.homey.flow.createToken("token_UNUSED_FLOWS", {
      type: "number",
      title: this.homey.__("settings.flows.unused_flows")
    });

    this.token_UNUSED_LOGIC = await this.homey.flow.createToken("token_UNUSED_LOGIC", {
      type: "number",
      title: this.homey.__("settings.flows.unused_logic")
    });

    await this.token_BROKEN.setValue(appSettings.BROKEN.length);
    await this.token_BROKEN_DISABLED.setValue(appSettings.BROKEN_DISABLED.length);
    await this.token_DISABLED.setValue(appSettings.DISABLED.length);
    await this.token_BROKEN_VARIABLE.setValue(appSettings.BROKEN_VARIABLE.length);
    await this.token_ALL_VARIABLES.setValue(appSettings.ALL_VARIABLES);
    await this.token_ALL_FLOWS.setValue(appSettings.ALL_FLOWS);
    await this.token_ALL_SCREENSAVERS.setValue(appSettings.ALL_SCREENSAVERS);
    await this.token_UNUSED_FLOWS.setValue(appSettings.UNUSED_FLOWS.length);
    await this.token_UNUSED_LOGIC.setValue(appSettings.UNUSED_LOGIC.length);
  }

  // -------------------- FUNCTIONS ----------------------

  async setFindFlowsInterval(clear = false, interval = null) {
    const REFRESH_INTERVAL = 1000 * (interval * 60);

    if (clear) {
      this.log(`[onPollInterval] - Clearinterval`);
      this.homey.clearInterval(this.onPollInterval);
    }

    this.log(`[onPollInterval]`, interval, REFRESH_INTERVAL);
    this.onPollInterval = this.homey.setInterval(this.findFlowDefects.bind(this), REFRESH_INTERVAL);
  }

  async setFolders() {
    try {
      await this.updateSettings({ FOLDERS: [...new Set(this.API_DATA.FOLDERS.map((folder) => ({ id: folder.id, name: folder.name })))] });
    } catch (error) {
      this.error("[setFolders]", error);
    }
  }

  async setApiData() {
    this.log(`[setApiData] Setting API_DATA`);
    await this._api.flow.connect();
    await this._api.flowtoken.connect();
    await sleep(2000);

    // Fill all caches
    this.API_DATA.FLOWTOKENS = Object.values(
      await this._api.flowtoken.getFlowTokens().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.API_DATA.FLOWS = Object.values(
      await this._api.flow.getFlows().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.API_DATA.ADVANCED_FLOWS = Object.values(
      await this._api.flow.getAdvancedFlows().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.API_DATA.FOLDERS = Object.values(
      await this._api.flow.getFlowFolders().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.API_DATA.SCREENSAVERS = this._hp23
      ? []
      : await this._api.ledring.getScreensavers().catch((e) => {
          console.log(e);
          return [];
        });

    this.API_DATA.APPS = Object.values(
      await this._api.apps.getApps().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.API_DATA.VARIABLES = Object.values(
      await this._api.logic.getVariables().catch((e) => {
        console.log(e);
        return {};
      })
    );

    this.log(`[setApiData] Setting API_DATA - data length:`, Object.keys(this.API_DATA).length);
  }

  async clearAPIData() {
    this.log(`[clearAPIData] Clearing API_DATA`);
    this.API_DATA = {};
  }

  async findFlowDefects(initial = false, force = false) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};

      if (initial && !FORCE_LOGGING) {
        this.log(`[findFlowDefects] - Initial wait for Homey to settle`);
        await sleep(15000);
      }

      if (!initial || appSettings.CHECK_ON_STARTUP || FORCE_LOGGING) {
        this.log(`[findFlowDefects] - Starting flow defect check | initial: ${initial} | force: ${force} | interval: ${this.interval}`);

        await this.setApiData();
        await this.setFolders();
        await this.findFlows("BROKEN");
        await this.findFlows("BROKEN_DISABLED");
        await this.findFlows("DISABLED");
        await this.findFlows("UNUSED_FLOWS");

        if (!this._isRunning && !initial && (force || this.interval % (appSettings.INTERVAL_FLOWS * 10) === 0)) {
          this.log(`[findFlowDefects] BROKEN_VARIABLE - this.interval: ${this.interval} | force: ${force}`);
          await this.logicChecks();
        }
      }

      if (initial && appSettings.INTERVAL_ENABLED) {
        this.log(`[findFlowDefects] - Setting interval on init`);
        await sleep(9000);
        await this.setFindFlowsInterval(false, appSettings.INTERVAL_FLOWS);
      }

      if (!force) this.interval = this.interval + appSettings.INTERVAL_FLOWS;
    } catch (error) {
      this.error(error);
    }
  }

  async logicChecks() {
    this._isRunning = true;
    await this.findLogic("BROKEN_VARIABLE");
    await this.findUnusedLogic("UNUSED_LOGIC");
    await this.clearAPIData();
    this._isRunning = false;
  }

  async findFlows(key) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
      const flowArray = appSettings[key];

      this.log(`[findFlows] ${key} - FlowArray: `, flowArray);
      let flows = [];

      if (key === "BROKEN" && this._hp23 && HP23_CHECK) {
        const f = this.API_DATA.FLOWS;
        const af = this.API_DATA.ADVANCED_FLOWS;

        const broken = [];

        // Regular flows
        for (const flow of f) {
          const isBroken = await flow.isBroken().catch(() => null);
          if (isBroken && flow.enabled) {
            broken.push(flow);
          }
        }

        // Advanced flows
        for (const aflow of af) {
          const isBroken = await aflow.isBroken().catch(() => null);
          if (isBroken && aflow.enabled) {
            broken.push(aflow);
          }
        }

        flows = broken;
      } else if (key === "BROKEN" && (!this._hp23 || !HP23_CHECK)) {
        const f = this.API_DATA.FLOWS.filter((flow) => flow.broken && flow.enabled);
        const af = this.API_DATA.ADVANCED_FLOWS.filter((aflow) => aflow.broken && flow.enabled);

        flows = [...f, ...af];
      } else if (key === "BROKEN_DISABLED" && this._hp23 && HP23_CHECK) {
        const f = this.API_DATA.FLOWS;
        const af = this.API_DATA.ADVANCED_FLOWS;

        const broken = [];

        // Regular flows
        for (const flow of f) {
          const isBroken = await flow.isBroken().catch(() => null);
          if (isBroken && !flow.enabled) {
            broken.push(flow);
          }
        }

        // Advanced flows
        for (const aflow of af) {
          const isBroken = await aflow.isBroken().catch(() => null);
          if (isBroken && !aflow.enabled) {
            broken.push(aflow);
          }
        }

        flows = broken;
      } else if (key === "BROKEN_DISABLED" && (!this._hp23 || !HP23_CHECK)) {
        const f = this.API_DATA.FLOWS.filter((flow) => flow.broken && !aflow.enabled);
        const af = this.API_DATA.ADVANCED_FLOWS.filter((aflow) => aflow.broken && !aflow.enabled);

        flows = [...f, ...af];
      } else if (key === "DISABLED") {
        const f = this.API_DATA.FLOWS.filter((flow) => !flow.enabled);
        const af = this.API_DATA.ADVANCED_FLOWS.filter((aflow) => !aflow.enabled);

        flows = [...f, ...af];
      } else if (key === "UNUSED_FLOWS") {
        const allFlows = this.API_DATA.FLOWS;
        const allAFFlows = this.API_DATA.ADVANCED_FLOWS;

        const actions = allFlows.flatMap((f) => f.actions.filter((a) => a.id.includes("homey:manager:flow:programmatic_trigger")).flatMap((b) => b.args.flow.id));
        const AFactions = allAFFlows.flatMap((flow) =>
          Object.values(flow.cards)
            .filter((f) => f.type === "action" && f.id.includes("homey:manager:flow:programmatic_trigger"))
            .flatMap((b) => b.args.flow.id)
        );
        const triggers = allFlows.filter((f) => f.trigger.id.includes("homey:manager:flow:programmatic_trigger") && !actions.includes(f.id) && !AFactions.includes(f.id));
        const AFtriggers = allAFFlows.filter((flow) => Object.values(flow.cards).some((f) => f.type === "trigger" && f.id.includes("homey:manager:flow:programmatic_trigger") && !actions.includes(f.id) && !AFactions.includes(f.id)));

        flows = [...triggers, ...AFtriggers];
      }

      flows = flows
        .filter((f) => f.folder && !appSettings.FILTERED_FOLDERS.includes(f.folder))
        .map((f) => {
          const folder = appSettings.FOLDERS.find((t) => t.id === f.folder);
          const folderName = folder ? folder.name : null;

          return { name: f.name, id: f.id, folder: folderName, advanced: "cards" in f };
        });

      if (appSettings[`CHECK_${key}`]) {
        await this.updateSettings({ [key]: [...new Set(flows)] });
        await this[`token_${key}`].setValue(flows.length);
        await this.checkFlowDiff(key, flows, flowArray);
      } else {
        await this.updateSettings({ [key]: [] });
        await this[`token_${key}`].setValue(0);
        await this.checkFlowDiff(key, [], flowArray);
      }
    } catch (error) {
      this.error("[findFlows]", error);
    }
  }

  async findLogic(key) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
      const flowArray = appSettings[key];
      const flowTokens = this.API_DATA.FLOWTOKENS;
      const screensavers = this.API_DATA.SCREENSAVERS;

      this.ALL_VARIABLES = 0;
      this.ALL_VARIABLES_OBJ = { logic: 0, device: 0, app: 0, bl: 0, fu: 0, screensavers: 0 };
      this.LOGIC_VARIABLES = [];
      const variablesPerFlowTemp = [];

      this.log(`[findLogic] ${key} - flowArray: `, flowArray);

      const homeyVariables = flowTokens.filter((f) => f.id.includes(`homey:manager:logic`)).map((f) => `homey:manager:logic|${f.id.split("homey:manager:logic:")[1]}`);
      this.log(`[findLogic] ${key} - homeyVariables: `, homeyVariables.length);

      const homeyDevices = flowTokens.filter((f) => f.id.includes(`homey:device`)).map((f) => `${replaceLast(f.id, ":", "|")}`);
      this.log(`[findLogic] ${key} - homeyDevices: `, homeyDevices.length);

      const homeyScreensavers = screensavers.map((f) => f.id);
      this.log(`[findLogic] ${key} - homeyScreensavers: `, homeyScreensavers.length);

      let homeyApps = this.API_DATA.APPS.filter((app) => app.enabled && !app.crashed).map((f) => `homey:app:${f.id}`);

      const homeyAppVariables = flowTokens.filter((f) => f.id.includes(`homey:app`)).map((f) => `${replaceLast(f.id, ":", "|")}`);
      this.log(`[findLogic] ${key} - homeyAppVariables: `, homeyAppVariables.length);

      // -------------APP SPECIFIC -----------------------
      let betterLogic = [];
      let flowUtils = [];

      if (homeyApps.includes(`homey:app:${externalAppKeyBL}`)) {
        betterLogic = await this._api.apps.getAppSetting({ name: "variables", id: externalAppKeyBL }).catch((e) => {
          console.log(e);
          return [];
        });

        if (FORCE_LOGGING) {
          this.log(`[findLogic] ${key} - betterLogic: `, betterLogic);
        }

        betterLogic = betterLogic && betterLogic.length ? betterLogic.map((f) => `homey:app:${externalAppKeyBL}|${f.name}`) : [];
      }

      if (homeyApps.includes(`homey:app:${externalAppKeyFU}`)) {
        let flowUtilsSettings = await this._api.apps.getAppSetting({ name: `${externalAppKeyFU}.settings`, id: externalAppKeyFU }).catch((e) => {
          console.log(e);
          return [];
        });
        const variables = flowUtilsSettings ? flowUtilsSettings.VARIABLES.map((p) => `homey:app:${externalAppKeyFU}|${p}`) : [];
        flowUtils = flowTokens.filter((f) => f.id.includes(`homey:app:${externalAppKeyFU}`)).map((f) => `${replaceLast(f.id, ":", "|")}`);
        flowUtils = [...variables, ...flowUtils, `homey:app:${externalAppKeyFU}|-All variables-`];
      }

      const logicMessages = [];
      const flows = FORCE_FLOW ? [FORCE_FLOW] : [...this.API_DATA.FLOWS, ...this.API_DATA.ADVANCED_FLOWS];

      let filteredFlows = [];
      for (const flow of flows) {
        let logicVariables = [];
        let deviceVariables = [];
        let appVariables = [];
        let blVariables = [];
        let fuVariables = [];
        let screensaverVariables = [];
        let cards = [];

        if (appSettings.FILTERED_FOLDERS.includes(flow.folder)) continue; // Skip filtered folders

        if (flow.cards) {
          cards = Object.values(flow.cards);
        } else {
          const { trigger, conditions, actions } = flow;
          cards = [trigger, ...conditions, ...actions];
        }

        for (const card of cards) {
          if (card.droptoken && card.droptoken.includes("homey:manager:logic")) {
            logicVariables.push(card.droptoken);
          } else if (card.droptoken && card.droptoken.includes("homey:device:")) {
            deviceVariables.push(card.droptoken);
          } else if (card.droptoken && card.droptoken.includes(`homey:app:${externalAppKeyBL}`)) {
            blVariables.push(card.droptoken);
          } else if (card.droptoken && card.droptoken.includes(`homey:app:${externalAppKeyFU}`)) {
            fuVariables.push(card.droptoken);
          } else if (card.droptoken && card.droptoken.includes("homey:app:")) {
            appVariables.push(card.droptoken);
          }

          if (card.args) {
            if (card.id && card.id.includes("homey:manager:logic") && card.args.variable && card.args.variable.id) {
              logicVariables.push(`homey:manager:logic|${card.args.variable.id}`);
            } else if (card.ownerUri && card.ownerUri === "homey:manager:logic" && card.args.variable && card.args.variable.id) {
              logicVariables.push(`homey:manager:logic|${card.args.variable.id}`);
            }

            if (card.id && card.id.includes(`homey:app:${externalAppKeyBL}`) && card.args.variable && card.args.variable.name) {
              blVariables.push(`homey:app:${externalAppKeyBL}|${card.args.variable.name}`);
            } else if (card.ownerUri && card.ownerUri === `homey:app:${externalAppKeyBL}` && card.args.variable && card.args.variable.name) {
              blVariables.push(`homey:app:${externalAppKeyBL}|${card.args.variable.name}`);
            }

            if (card.id && card.id.includes(`homey:app:${externalAppKeyFU}`) && card.args.variable && card.args.variable.name) {
              fuVariables.push(`homey:app:${externalAppKeyFU}|${card.args.variable.name}`);
            } else if (card.ownerUri && card.ownerUri === `homey:app:${externalAppKeyFU}` && card.args.variable && card.args.variable.name) {
              fuVariables.push(`homey:app:${externalAppKeyFU}|${card.args.variable.name}`);
            }

            if (card.id && card.id.includes("homey:manager:ledring") && card.args.screensaver && card.args.screensaver.uri && card.args.screensaver.uri !== "homey:manager:ledring") {
              appVariables.push(`${card.args.screensaver.uri}`);
            } else if (card.ownerUri && card.ownerUri === "homey:manager:ledring" && card.args.screensaver && card.args.screensaver.uri && card.args.screensaver.uri !== "homey:manager:ledring") {
              appVariables.push(`${card.args.screensaver.uri}`);
            }

            if (!this._hp23 && card.id && card.id.includes("homey:manager:ledring") && card.args.screensaver && card.args.screensaver.id) {
              screensaverVariables.push(`${card.args.screensaver.id}`);
            } else if (!this._hp23 && card.ownerUri && card.ownerUri === "homey:manager:ledring" && card.args.screensaver && card.args.screensaver.id) {
              screensaverVariables.push(`${card.args.screensaver.id}`);
            }

            let argsArray = (card.args && Object.values(card.args)) || [];
            if (!argsArray || !argsArray.length) continue;

            argsArray = flattenObj(card.args);

            const logicVar = argsArray.filter((arg) => typeof arg === "string" && arg.includes("homey:manager:logic"));
            const logicDevice = argsArray.filter((arg) => typeof arg === "string" && arg.includes("homey:device"));
            const logicApp = argsArray.filter((arg) => typeof arg === "string" && arg.includes("homey:app"));
            const logicBL = argsArray.filter((arg) => typeof arg === "string" && arg.includes(`homey:app:${externalAppKeyBL}`));
            const logicFU = argsArray.filter((arg) => typeof arg === "string" && arg.includes(`homey:app:${externalAppKeyFU}`));

            if (logicVar && logicVar.length) {
              logicVar.forEach((lv) => {
                const match = lv.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                const varArray = match ? match.filter((l) => l.includes("homey:manager:logic")) : [];
                logicVariables = [...logicVariables, ...varArray];
              });
            }

            if (logicDevice && logicDevice.length) {
              logicDevice.forEach((ld) => {
                const match = ld.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                const varArray = match ? match.filter((l) => l.includes("homey:device")) : [];
                deviceVariables = [...deviceVariables, ...varArray];
              });
            }

            if (logicApp && logicApp.length) {
              logicApp.forEach((la) => {
                const match = la.match(/(?<=\[\[)(homey:app:)(.*?)(?=\]\])/g);
                const varArray = match ? match.filter((l) => !l.includes(externalAppKeyBL) & !l.includes(externalAppKeyFU)) : [];
                appVariables = [...appVariables, ...varArray];
              });
            }

            if (logicBL && logicBL.length) {
              logicBL.forEach((lbl) => {
                const match = lbl.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                const varArray = match ? match.filter((l) => l.includes(`homey:app:${externalAppKeyBL}`)) : [];
                blVariables = [...blVariables, ...varArray];
              });
            }

            if (logicFU && logicFU.length) {
              logicFU.forEach((lfu) => {
                const match = lfu.match(/(?<=\[\[)(.*?)(?=\]\])/g);
                const varArray = match ? match.filter((l) => l.includes(`homey:app:${externalAppKeyFU}`)) : [];
                fuVariables = [...fuVariables, ...varArray];
              });
            }
          }
        }

        const variablesLength = logicVariables.length + deviceVariables.length + appVariables.length + blVariables.length + fuVariables.length;

        this.ALL_VARIABLES = this.ALL_VARIABLES + variablesLength;
        this.ALL_VARIABLES_OBJ = {
          logic: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.logic + logicVariables.length : logicVariables.length,
          device: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.device + deviceVariables.length : deviceVariables.length,
          app: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.app + appVariables.length : appVariables.length,
          bl: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.bl + blVariables.length : blVariables.length,
          fu: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.fu + fuVariables.length : fuVariables.length,
          screensavers: this.ALL_VARIABLES_OBJ ? this.ALL_VARIABLES_OBJ.screensavers + screensaverVariables.length : screensaverVariables.length
        };

        if (variablesLength && VARIABLES_PER_FLOW_CHECK && variablesPerFlowTemp.length < MAX_FLOWS_FOR_STATS) {
          variablesPerFlowTemp.push({
            flow: { id: flow.id, name: flow.name, folder: flow.folder || "", advanced: "cards" in flow },
            logic: logicVariables,
            device: deviceVariables,
            app: appVariables,
            bl: blVariables,
            fu: fuVariables,
            screensavers: screensaverVariables
          });
        }

        this.LOGIC_VARIABLES = [...this.LOGIC_VARIABLES, ...logicVariables];

        if (FORCE_LOGGING && variablesLength) {
          console.log(`[findLogic] ---------------------START---------------------------`);
          console.log(`[findLogic]`, flow.name);
          if (logicVariables.length) console.log(`[findLogic] ${key} - logicVariables: `, logicVariables);
          if (deviceVariables.length) console.log(`[findLogic] ${key} - deviceVariables: `, deviceVariables);
          if (appVariables.length) console.log(`[findLogic] ${key} - appVariables: `, appVariables);
          if (blVariables.length) console.log(`[findLogic] ${key} - blVariables: `, blVariables);
          if (fuVariables.length) console.log(`[findLogic] ${key} - fuVariables: `, fuVariables);
          if (screensaverVariables.length) console.log(`[findLogic] ${key} - screensaverVariables: `, screensaverVariables);
          console.log(`[findLogic] ---------------------END---------------------------`);
        }

        if (logicVariables.length && logicVariables.some((r) => homeyVariables.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "Logic variable" });
          filteredFlows.push(flow);
        }
        if (deviceVariables.length && deviceVariables.some((r) => homeyDevices.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "Device variable" });
          filteredFlows.push(flow);
        }
        if (screensaverVariables.length && screensaverVariables.some((r) => homeyScreensavers.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "Screensaver missing" });
          filteredFlows.push(flow);
        }
        if (blVariables.length && blVariables.some((r) => betterLogic.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "BetterLogic" });
          filteredFlows.push(flow);
        }
        if (fuVariables.length && fuVariables.some((r) => flowUtils.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "Flow Utillities" });
          filteredFlows.push(flow);
        }
        if (appVariables.length && appVariables.some((r) => homeyAppVariables.indexOf(r) === -1)) {
          logicMessages.push({ id: flow.id, msg: "Broken app" });
          filteredFlows.push(flow);
        }
      }

      filteredFlows = filteredFlows.map((filteredFlow) => {
        const folder = appSettings.FOLDERS.find((t) => t.id === filteredFlow.folder);
        const logicMessage = logicMessages.find((m) => m.id === filteredFlow.id) || "Unknown";
        const folderName = folder ? folder.name : "unknown";

        return { name: filteredFlow.name, id: filteredFlow.id, folder: folderName, advanced: "cards" in filteredFlow, logicMessage: logicMessage.msg };
      });

      await this.token_ALL_FLOWS.setValue(flows.length);
      await this.token_ALL_SCREENSAVERS.setValue(homeyScreensavers.length);
      await this.token_ALL_VARIABLES.setValue(this.ALL_VARIABLES);

      const flowSet = appSettings[`CHECK_${key}`] ? [...new Set(filteredFlows)] : [];

      await this.updateSettings({
        [key]: flowSet,
        ALL_FLOWS: flows.length,
        ALL_SCREENSAVERS: homeyScreensavers.length,
        ALL_VARIABLES: this.ALL_VARIABLES,
        ALL_VARIABLES_OBJ: this.ALL_VARIABLES_OBJ
      });

      if (appSettings[`CHECK_${key}`]) {
        await this[`token_${key}`].setValue(filteredFlows.length);
        await this.checkFlowDiff(key, filteredFlows, flowArray);
      } else {
        await this.updateSettings({ [key]: [] });
        await this[`token_${key}`].setValue(0);
        await this.checkFlowDiff(key, [], flowArray);
      }

      if (VARIABLES_PER_FLOW_CHECK && variablesPerFlowTemp.length) {
        await this.updateVariablesPerFlow(variablesPerFlowTemp);
      }
    } catch (error) {
      this.error("[findLogic]", error);
    }
  }

  async findUnusedLogic(key) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
      const logicArray = appSettings[key];
      const homeyVariables = this.API_DATA.VARIABLES;
      const logicVariables = this.LOGIC_VARIABLES;

      this.log(`[findUnusedLogic] ${key} - logicArray: `, logicArray);
      let logic = homeyVariables.filter((r) => logicVariables.indexOf(`homey:manager:logic|${r.id}`) === -1);

      logic = logic.map((f) => ({ name: f.name, id: f.id, type: f.type, value: f.value }));

      if (logicArray.length !== logic.length && appSettings[`CHECK_${key}`]) {
        await this.updateSettings({ [key]: [...new Set(logic)] });
        await this[`token_${key}`].setValue(logic.length);
        await this.checkFlowDiff(key, logic, logicArray, true);
      } else if (!appSettings[`CHECK_${key}`]) {
        await this.updateSettings({ [key]: [] });
        await this[`token_${key}`].setValue(0);
        await this.checkFlowDiff(key, [], logicArray, true);
      }

      this.LOGIC_VARIABLES = [];
    } catch (error) {
      this.error("[findUnusedLogic]", error);
    }
  }

  async checkFlowDiff(key, flows, flowArray, logic = false) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
      let flowDiff = flows.filter(({ id: id1 }) => !flowArray.some(({ id: id2 }) => id2 === id1));
      let flowDiffReverse = flowArray.filter(({ id: id1 }) => !flows.some(({ id: id2 }) => id2 === id1));

      this.log(`[flowDiff] ${key} - flowDiff: `, flowDiff);
      this.log(`[flowDiff] ${key} - flowDiffReverse: `, flowDiffReverse);

      if (flowDiff.length) {
        flowDiff.forEach(async (flow, index) => {
          const logicMessage = flow.logicMessage ? flow.logicMessage : false;
          await this.setNotification(key, flow.name, flow.folder, logic ? "Variable" : "Flow", logicMessage);

          if (index < 10) {
            const folder = flow.folder ? flow.folder : "unknown";
            await this.homey.flow
              .getTriggerCard(`trigger_${key}`)
              .trigger({ flow: flow.name, id: flow.id, type: key, folder })
              .catch(this.error)
              .then(this.log(`[flowDiff] ${key} - Triggered: "${flow.name} | ${flow.id}"`));
          }
        });
      }

      if (flowDiffReverse.length && logic && appSettings[`CHECK_FIXED_LOGIC`]) {
        flowDiffReverse.forEach(async (logic) => {
          await this.setNotification("FIXED_LOGIC", logic.name, null, "Variable");

          await this.homey.flow
            .getTriggerCard(`trigger_FIXED_LOGIC`)
            .trigger({ logic: logic.name, id: logic.id })
            .catch(this.error)
            .then(this.log(`[flowDiff] FIXED_LOGIC - Triggered: "${logic.name} | ${logic.id}"`));
        });
      } else if (flowDiffReverse.length && appSettings[`CHECK_FIXED`]) {
        flowDiffReverse.forEach(async (flow, index) => {
          if (index < 10) {
            await this.setNotification("FIXED", flow.name, flow.folder, "Flow");

            const folder = flow.folder ? flow.folder : "unknown";
            await this.homey.flow
              .getTriggerCard(`trigger_FIXED`)
              .trigger({ flow: flow.name, id: flow.id, type: key, folder })
              .catch(this.error)
              .then(this.log(`[flowDiff] FIXED - Triggered: "${flow.name} | ${flow.id}"`));
          }
        });
      }
    } catch (error) {
      this.error("[checkFlowDiff]", error);
    }
  }

  async setNotification(key, flow, folderName, type, logicMessage = false) {
    try {
      const appSettings = (await this.homey.settings.get(_settingsKey)) || {};
      if (appSettings[`NOTIFICATION_${key}`]) {
        const folder = folderName ? `| Folder: **${folderName}**` : "";
        const logicMsg = logicMessage ? `| Reason: **${logicMessage}**` : "";
        await this.homey.notifications.createNotification({
          excerpt: `FlowChecker -  Event: ${key} - ${type}: **${flow}** ${folder} ${logicMsg}`
        });
      }
    } catch (error) {
      this.error(error);
    }
  }

  async updateVariablesPerFlow(flowDataArray = []) {
    const homeyLogicTokens = this.API_DATA.FLOWTOKENS.filter((t) => t.ownerUri === "homey:manager:logic");
    const logicMappedToFlow = [];
    let updatedVariablesPerFlow = [];

    this.log(`[updateVariablesPerFlow] - flowDataArray length: ${flowDataArray.length}`);

    for (const flowData of flowDataArray) {
      const updatedVariables = await this.mapVariablesToFlow(flowData);
      updatedVariablesPerFlow = [...updatedVariablesPerFlow, updatedVariables];
    }

    homeyLogicTokens.forEach((token) => {
      const flowsUsingToken = [];
      updatedVariablesPerFlow.forEach((f) => {
        if (f.logic.some((l) => l.id === token.id)) {
          flowsUsingToken.push({ id: f.flow.id, name: f.flow.name, advanced: f.flow.advanced });
        }
      });

      logicMappedToFlow.push({ token: token.title, id: token.id, type: token.type, flows: flowsUsingToken });
    });

    await this.updateSettings({
      VARIABLES_PER_FLOW: updatedVariablesPerFlow.sort((a, b) => a.flow.name.localeCompare(b.flow.name)),
      FLOW_LOGIC_MAP: logicMappedToFlow.sort((a, b) => a.token.localeCompare(b.token))
    });
  }

  async mapVariablesToFlow(flowData) {
    const { flow, logic, device, app, bl, fu, screensavers } = flowData;

    const mappedLogic = logic
      .map((l) => {
        const tokenId = l.split("|")[1];
        const token = this.API_DATA.FLOWTOKENS.find((t) => t.id === `homey:manager:logic:${tokenId}`);
        if (token && tokenId) {
          return { name: token.name || token.title, id: token.id, type: token.type };
        } else {
          return null;
        }
      })
      .filter((f) => f !== null);

    const mappedDevice = device
      .map((l) => {
        const token = this.API_DATA.FLOWTOKENS.find((t) => t.id === l.replace("|", ":"));
        if (token) {
          return { name: token.name || token.title, id: token.id, type: token.type };
        } else {
          return null;
        }
      })
      .filter((f) => f !== null);

    const mappedApp = app
      .map((l) => {
        const appId = l.split(":")[2];
        const token = this.API_DATA.APPS.find((t) => t.id === appId);
        if (token) {
          return { name: token.name, id: token.id };
        } else {
          return null;
        }
      })
      .filter((f) => f !== null);

    const mappedBL = bl
      .map((l) => {
        const varName = l.split("|")[1];
        return { name: varName };
      })
      .filter((f) => f !== null);

    const mappedFU = fu
      .map((l) => {
        const varName = l.split("|")[1];
        return { name: varName };
      })
      .filter((f) => f !== null);

    const mappedScreensavers = screensavers
      .map((id) => {
        const screensaver = this.API_DATA.SCREENSAVERS.find((s) => s.id === id);
        if (screensaver) {
          return { name: screensaver.name, id: screensaver.id };
        } else {
          return null;
        }
      })
      .filter((f) => f !== null);

    // make sure logic / device /app variables are unique
    const updatedVariablesPerFlow = {
      flow,
      logic: mappedLogic.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i),
      device: mappedDevice.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i),
      app: mappedApp.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i),
      bl: mappedBL.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i),
      fu: mappedFU.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i),
      screensavers: mappedScreensavers.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
    };

    return updatedVariablesPerFlow;
  }
}

module.exports = App;
