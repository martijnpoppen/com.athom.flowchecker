exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// function flattenObjectToValues(obj, parent, res = {}) {
//   for (const key of Object.keys(obj)) {
//     const propName = parent ? parent + "." + key : key;
//     if (typeof obj[key] === "object") {
//       console.log(obj[key]);
//       flattenObjectToValues(obj[key], propName, res);
//     } else {
//       res[propName] = obj[key];
//     }
//   }
//   return Object.values(res);
// }

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
