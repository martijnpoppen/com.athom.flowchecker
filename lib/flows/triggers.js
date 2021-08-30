// ---------------------------------------INIT FUNCTION----------------------------------------------------------
exports.init = async function (homey) {
    homey.flow.getTriggerCard('trigger_BROKEN').register();
    homey.flow.getTriggerCard('trigger_DISABLED').register();
};