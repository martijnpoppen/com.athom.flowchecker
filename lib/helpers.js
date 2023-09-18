exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

function flattenObjectToValues(obj) {
  const flattened = {};

  Object.keys(obj).forEach((key) => {
    const value = obj[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, flattenObjectToValues(value));
    } else {
      flattened[key] = value;
    }
  });

  return Object.values(flattened);
}


function replaceLast(str, what, replacement) {
    var pcs = str.split(what);
    var lastPc = pcs.pop();
    return pcs.join(what) + replacement + lastPc;
};

exports.flattenObj = flattenObjectToValues;
exports.replaceLast = replaceLast;
