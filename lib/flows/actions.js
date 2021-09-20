exports.init = async function (homey) {
    const action_check_flows = homey.flow.getActionCard('action_check_flows');
    action_check_flows.registerRunListener(async () => {
        homey.app.log("[action_check_flows] - findFlowDefects");
        await homey.app.findFlowDefects(false, true);
    });

    const action_set_flow_interval = homey.flow.getActionCard('action_set_flow_interval');
    action_set_flow_interval.registerRunListener(async (args) => {
        homey.app.log("[action_set_flow_interval] - Set intervals", args);
        await homey.app.updateSettings({ ...homey.app.appSettings, INTERVAL_FLOWS: args.minutes});
    });
};