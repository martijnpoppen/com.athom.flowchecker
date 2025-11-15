const { withTimeout } = require('../helpers.js');

exports.init = async function (homey) {
    const action_check_flows = homey.flow.getActionCard('action_check_flows');
    action_check_flows.registerRunListener(async () => {
        homey.app.log("[action_check_flows] - findFlowDefects");
        await withTimeout(homey.app.findFlowDefects(false, true), 5000).catch((err) => true);
    });

    const action_set_flow_interval = homey.flow.getActionCard('action_set_flow_interval');
    action_set_flow_interval.registerRunListener(async (args) => {
        homey.app.log("[action_set_flow_interval] - Set intervals", args);
        await homey.app.updateSettings({ INTERVAL_FLOWS: args.minutes});
    });

    const action_disable_flow_interval = homey.flow.getActionCard('action_disable_flow_interval');
    action_disable_flow_interval.registerRunListener(async (args) => {
        homey.app.log("[action_disable_flow_interval] - Disable");
        await homey.app.updateSettings({ INTERVAL_ENABLED: false});
    });

    const action_enable_flow_interval = homey.flow.getActionCard('action_enable_flow_interval');
    action_enable_flow_interval.registerRunListener(async (args) => {
        homey.app.log("[action_enable_flow_interval] - Enable");
        await homey.app.updateSettings({ INTERVAL_ENABLED: true});
    });
};