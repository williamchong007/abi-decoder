"use strict";

var _values = require("babel-runtime/core-js/object/values");

var _values2 = _interopRequireDefault(_values);

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Web3 = require('web3');

var web3 = new Web3();
var sha3 = web3.utils.sha3;
var BN = web3.utils.BN;

var state = {
  savedABIs: [],
  methodIDs: {}
};

function _getABIs() {
  return state.savedABIs;
}

function _addABI(abiArray) {
  if (Array.isArray(abiArray)) {

    // Iterate new abi to generate method id's
    abiArray.map(function (abi) {
      if (abi.name) {
        var signature = sha3(abi.name + "(" + abi.inputs.map(function (input) {
          return input.type;
        }).join(",") + ")");
        if (abi.type == "event") {
          state.methodIDs[signature.slice(2)] = abi;
        } else {
          state.methodIDs[signature.slice(2, 10)] = abi;
        }
      }
    });

    state.savedABIs = state.savedABIs.concat(abiArray);
  } else {
    throw new Error("Expected ABI array, got " + (typeof abiArray === "undefined" ? "undefined" : (0, _typeof3.default)(abiArray)));
  }
}

function _removeABI(abiArray) {
  if (Array.isArray(abiArray)) {

    // Iterate new abi to generate method id's
    abiArray.map(function (abi) {
      if (abi.name) {
        var signature = sha3(abi.name + "(" + abi.inputs.map(function (input) {
          return input.type;
        }).join(",") + ")");
        if (abi.type == "event") {
          if (state.methodIDs[signature.slice(2)]) {
            delete state.methodIDs[signature.slice(2)];
          }
        } else {
          if (state.methodIDs[signature.slice(2, 10)]) {
            delete state.methodIDs[signature.slice(2, 10)];
          }
        }
      }
    });
  } else {
    throw new Error("Expected ABI array, got " + (typeof abiArray === "undefined" ? "undefined" : (0, _typeof3.default)(abiArray)));
  }
}

function _getMethodIDs() {
  return state.methodIDs;
}

function _decodeMethod(data) {
  var methodID = data.slice(2, 10);
  var abiItem = state.methodIDs[methodID];
  if (abiItem) {
    var params = abiItem.inputs.map(function (item) {
      return item.type;
    });
    var decoded = web3.eth.abi.decodeParameters(params, data.slice(10));
    delete decoded.__length__;
    decoded = (0, _values2.default)(decoded);
    return {
      name: abiItem.name,
      params: decoded.map(function (param, index) {
        var parsedParam = param;
        var isUint = abiItem.inputs[index].type.indexOf("uint") == 0;
        var isInt = abiItem.inputs[index].type.indexOf("int") == 0;

        if (isUint || isInt) {
          var isArray = Array.isArray(param);

          if (isArray) {
            parsedParam = param.map(function (val) {
              return new BN(val).toString();
            });
          } else {
            parsedParam = new BN(param).toString();
          }
        }
        return {
          name: abiItem.inputs[index].name,
          value: parsedParam,
          type: abiItem.inputs[index].type
        };
      })
    };
  }
}

function handleZeros(address) {
  var formatted = address;
  if (address.indexOf('0x') != -1) {
    formatted = address.slice(2);
  }

  if (formatted.length < 40) {
    while (formatted.length < 40) {
      formatted = "0" + formatted;
    }
  } else if (formatted.length > 40) {
    formatted = formatted.slice(-40);
  }

  return "0x" + formatted;
};

function _decodeLogs(logs) {
  return logs.map(function (logItem) {
    var methodID = logItem.topics[0].slice(2);
    var method = state.methodIDs[methodID];
    if (method) {
      var logData = logItem.data;
      var decodedParams = [];
      var dataIndex = 0;
      var topicsIndex = 1;

      var dataTypes = [];
      method.inputs.map(function (input) {
        if (!input.indexed) {
          dataTypes.push(input.type);
        }
      });
      var decodedData = web3.eth.abi.decodeParameters(dataTypes, logData.slice(2));
      delete decodedData.__length__;
      decodedData = (0, _values2.default)(decodedData);
      // Loop topic and data to get the params
      method.inputs.map(function (param) {
        var decodedP = {
          name: param.name,
          type: param.type
        };

        if (param.indexed) {
          decodedP.value = logItem.topics[topicsIndex];
          topicsIndex++;
        } else {
          decodedP.value = decodedData[dataIndex];
          dataIndex++;
        }

        if (param.type == "address") {
          decodedP.value = handleZeros(decodedP.value);
        } else if (param.type == "uint256" || param.type == "uint8" || param.type == "int") {
          decodedP.value = new BN(decodedP.value).toString(10);
        }

        decodedParams.push(decodedP);
      });

      return {
        name: method.name,
        events: decodedParams,
        address: logItem.address
      };
    }
  });
}

module.exports = {
  getABIs: _getABIs,
  addABI: _addABI,
  getMethodIDs: _getMethodIDs,
  decodeMethod: _decodeMethod,
  decodeLogs: _decodeLogs,
  removeABI: _removeABI
};