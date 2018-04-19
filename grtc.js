/*!
 * @license Genesys WebRTC Service JSAPI
 * Copyright (c) 2016 Genesys Telecommunications Laboratories, Inc.
 * All rights reserved.
 */
var GRTC_VERSION = "8.5.210.34";

/*!
 * Portions of this software is based on http://code.google.com/p/webrtc-samples/
 * and it is covered by the following:
 *
 * Copyright (C) 2012 Google.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *    * Neither the name of Google nor the
 *      names of its contributors may be used to endorse or promote products
 *      derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL GOOGLE BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

 /*!
  * Portions of this software is based on https://github.com/webrtc/adapter
  * and is covered by the following:
  *
  * Copyright (c) 2016, The WebRTC project authors. All rights reserved.

  * Redistribution and use in source and binary forms, with or without
  * modification, are permitted provided that the following conditions are met:
  *   * Redistributions of source code must retain the above copyright
  *     notice, this list of conditions and the following disclaimer.
  *   * Redistributions in binary form must reproduce the above copyright
  *     notice, this list of conditions and the following disclaimer in the
  *     documentation and/or other materials provided with the distribution.
  *   * Neither the name of Google nor the names of its contributors may be
  *     used to endorse or promote products derived from this software
  *     without specific prior written permission.
  *
  * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
  * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
  * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
  * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
  * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
  * USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  */

"use strict";

// Adapter
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
var webrtcMinimumVersion = null;
var webrtcUtils = {
  log: function(arg1) {
    // suppress console.log output when being included as a module.
    if (typeof module !== 'undefined' ||
        typeof require === 'function' && typeof define === 'function') {
      return;
    }
    //console.log.apply(console, arguments);  // This is not supported in IE
    console.log(arg1);
  },
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  }
};

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    webrtcUtils.log(now + ': ' + text);
  } else {
    webrtcUtils.log(text);
  }
}

if (typeof window === 'object') {
  if (window.HTMLMediaElement &&
    !('srcObject' in window.HTMLMediaElement.prototype)) {
    // Shim the srcObject property, once, when HTMLMediaElement is found.
    Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
      get: function() {
        // If prefixed srcObject property exists, return it.
        // Otherwise use the shimmed property, _srcObject
        return 'mozSrcObject' in this ? this.mozSrcObject : this._srcObject;
      },
      set: function(stream) {
        if ('mozSrcObject' in this) {
          this.mozSrcObject = stream;
        } else {
          // Use _srcObject as a private property for this shim
          this._srcObject = stream;
          // TODO: revokeObjectUrl(this.src) when !stream to release resources?
          this.src = URL.createObjectURL(stream);
        }
      }
    });
  }
  // Proxy existing globals
  getUserMedia = window.navigator && window.navigator.getUserMedia;
}

// Attach a media stream to an element.
attachMediaStream = function(element, stream) {
  element.srcObject = stream;
};

reattachMediaStream = function(to, from) {
  to.srcObject = from.srcObject;
};

if (typeof window === 'undefined' || !window.navigator) {
  webrtcUtils.log('This does not appear to be a browser');
  webrtcDetectedBrowser = 'not a browser';
} else if (navigator.mozGetUserMedia) {
  webrtcUtils.log('This appears to be Firefox');

  webrtcDetectedBrowser = 'firefox';

  // the detected firefox version.
  webrtcDetectedVersion = webrtcUtils.extractVersion(navigator.userAgent,
      /Firefox\/([0-9]+)\./, 1);

  // the minimum firefox version still supported by adapter.
  webrtcMinimumVersion = 31;

  // Shim for RTCPeerConnection on older versions.
  if (!window.RTCPeerConnection) {
    window.RTCPeerConnection = function(pcConfig, pcConstraints) {
      if (webrtcDetectedVersion < 38) {
        // .urls is not supported in FF < 38.
        // create RTCIceServers with a single url.
        if (pcConfig && pcConfig.iceServers) {
          var newIceServers = [];
          for (var i = 0; i < pcConfig.iceServers.length; i++) {
            var server = pcConfig.iceServers[i];
            if (server.hasOwnProperty('urls')) {
              for (var j = 0; j < server.urls.length; j++) {
                var newServer = {
                  url: server.urls[j]
                };
                if (server.urls[j].indexOf('turn') === 0) {
                  newServer.username = server.username;
                  newServer.credential = server.credential;
                }
                newIceServers.push(newServer);
              }
            } else {
              newIceServers.push(pcConfig.iceServers[i]);
            }
          }
          pcConfig.iceServers = newIceServers;
        }
      }
      return new mozRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
    };
    window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

    // wrap static methods. Currently just generateCertificate.
    if (mozRTCPeerConnection.generateCertificate) {
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          if (arguments.length) {
            return mozRTCPeerConnection.generateCertificate.apply(null,
                arguments);
          } else {
            return mozRTCPeerConnection.generateCertificate;
          }
        }
      });
    }

    window.RTCSessionDescription = mozRTCSessionDescription;
    window.RTCIceCandidate = mozRTCIceCandidate;
  }

  // getUserMedia constraints shim.
  getUserMedia = function(constraints, onSuccess, onError) {
    var constraintsToFF37 = function(c) {
      if (typeof c !== 'object' || c.require) {
        return c;
      }
      var require = [];
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = c[key] = (typeof c[key] === 'object') ?
            c[key] : {ideal: c[key]};
        if (r.min !== undefined ||
            r.max !== undefined || r.exact !== undefined) {
          require.push(key);
        }
        if (r.exact !== undefined) {
          if (typeof r.exact === 'number') {
            r.min = r.max = r.exact;
          } else {
            c[key] = r.exact;
          }
          delete r.exact;
        }
        if (r.ideal !== undefined) {
          c.advanced = c.advanced || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[key] = {min: r.ideal, max: r.ideal};
          } else {
            oc[key] = r.ideal;
          }
          c.advanced.push(oc);
          delete r.ideal;
          if (!Object.keys(r).length) {
            delete c[key];
          }
        }
      });
      if (require.length) {
        c.require = require;
      }
      return c;
    };
    if (webrtcDetectedVersion < 38) {
      webrtcUtils.log('spec: ' + JSON.stringify(constraints));
      if (constraints.audio) {
        constraints.audio = constraintsToFF37(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToFF37(constraints.video);
      }
      webrtcUtils.log('ff37: ' + JSON.stringify(constraints));
    }
    return navigator.mozGetUserMedia(constraints, onSuccess, onError);
  };

  navigator.getUserMedia = getUserMedia;

  // Shim for mediaDevices on older versions.
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {getUserMedia: requestUserMedia,
      addEventListener: function() { },
      removeEventListener: function() { }
    };
  }
  navigator.mediaDevices.enumerateDevices =
      navigator.mediaDevices.enumerateDevices || function() {
    return new Promise(function(resolve) {
      var infos = [
        {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
        {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
      ];
      resolve(infos);
    });
  };

  if (webrtcDetectedVersion < 41) {
    // Work around http://bugzil.la/1169665
    var orgEnumerateDevices =
        navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function() {
      return orgEnumerateDevices().then(undefined, function(e) {
        if (e.name === 'NotFoundError') {
          return [];
        }
        throw e;
      });
    };
  }
} else if (navigator.webkitGetUserMedia && window.webkitRTCPeerConnection) {
  webrtcUtils.log('This appears to be Chrome');

  webrtcDetectedBrowser = 'chrome';

  // the detected chrome version.
  webrtcDetectedVersion = webrtcUtils.extractVersion(navigator.userAgent,
      /Chrom(e|ium)\/([0-9]+)\./, 2);

  // the minimum chrome version still supported by adapter.
  webrtcMinimumVersion = 38;

  // Setup ajax for sending requests with credentials (cookies set by the gateway).
  // This seems to create problem with Firefox, so only doing this for Chrome.
  $.ajaxSetup({
    xhrFields: {withCredentials: true}
  });

  // The RTCPeerConnection object.
  window.RTCPeerConnection = function(pcConfig, pcConstraints) {
    // Translate iceTransportPolicy to iceTransports,
    // see https://code.google.com/p/webrtc/issues/detail?id=4869
    if (pcConfig && pcConfig.iceTransportPolicy) {
      pcConfig.iceTransports = pcConfig.iceTransportPolicy;
    }

    var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints); // jscs:ignore requireCapitalizedConstructors
    var origGetStats = pc.getStats.bind(pc);
    pc.getStats = function(selector, successCallback, errorCallback) { // jshint ignore: line
      var self = this;
      var args = arguments;

      // If selector is a function then we are in the old style stats so just
      // pass back the original getStats format to avoid breaking old users.
      if (arguments.length > 0 && typeof selector === 'function') {
        return origGetStats(selector, successCallback);
      }

      var fixChromeStats = function(response) {
        var standardReport = {};
        var reports = response.result();
        reports.forEach(function(report) {
          var standardStats = {
            id: report.id,
            timestamp: report.timestamp,
            type: report.type
          };
          report.names().forEach(function(name) {
            standardStats[name] = report.stat(name);
          });
          standardReport[standardStats.id] = standardStats;
        });

        return standardReport;
      };

      if (arguments.length >= 2) {
        var successCallbackWrapper = function(response) {
          args[1](fixChromeStats(response));
        };

        return origGetStats.apply(this, [successCallbackWrapper, arguments[0]]);
      }

      // promise-support
      return new Promise(function(resolve, reject) {
        if (args.length === 1 && selector === null) {
          origGetStats.apply(self, [
              function(response) {
                resolve.apply(null, [fixChromeStats(response)]);
              }, reject]);
        } else {
          origGetStats.apply(self, [resolve, reject]);
        }
      });
    };

    return pc;
  };
  window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;

  // wrap static methods. Currently just generateCertificate.
  if (webkitRTCPeerConnection.generateCertificate) {
    Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
      get: function() {
        if (arguments.length) {
          return webkitRTCPeerConnection.generateCertificate.apply(null,
              arguments);
        } else {
          return webkitRTCPeerConnection.generateCertificate;
        }
      }
    });
  }

  // add promise support
  ['createOffer', 'createAnswer'].forEach(function(method) {
    var nativeMethod = webkitRTCPeerConnection.prototype[method];
    webkitRTCPeerConnection.prototype[method] = function() {
      var self = this;
      if (arguments.length < 1 || (arguments.length === 1 &&
          typeof(arguments[0]) === 'object')) {
        var opts = arguments.length === 1 ? arguments[0] : undefined;
        return new Promise(function(resolve, reject) {
          nativeMethod.apply(self, [resolve, reject, opts]);
        });
      } else {
        return nativeMethod.apply(this, arguments);
      }
    };
  });

  ['setLocalDescription', 'setRemoteDescription',
      'addIceCandidate'].forEach(function(method) {
    var nativeMethod = webkitRTCPeerConnection.prototype[method];
    webkitRTCPeerConnection.prototype[method] = function() {
      var args = arguments;
      var self = this;
      return new Promise(function(resolve, reject) {
        nativeMethod.apply(self, [args[0],
            function() {
              resolve();
              if (args.length >= 2) {
                args[1].apply(null, []);
              }
            },
            function(err) {
              reject(err);
              if (args.length >= 3) {
                args[2].apply(null, [err]);
              }
            }]
          );
      });
    };
  });

  // getUserMedia constraints shim.
  var constraintsToChrome = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  getUserMedia = function(constraints, onSuccess, onError) {
    if (constraints.audio) {
      constraints.audio = constraintsToChrome(constraints.audio);
    }
    if (constraints.video) {
      constraints.video = constraintsToChrome(constraints.video);
    }
    webrtcUtils.log('chrome: ' + JSON.stringify(constraints));
    return navigator.webkitGetUserMedia(constraints, onSuccess, onError);
  };
  navigator.getUserMedia = getUserMedia;

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {getUserMedia: requestUserMedia,
                              enumerateDevices: function() {
      return new Promise(function(resolve) {
        var kinds = {audio: 'audioinput', video: 'videoinput'};
        return MediaStreamTrack.getSources(function(devices) {
          resolve(devices.map(function(device) {
            return {label: device.label,
                    kind: kinds[device.kind],
                    deviceId: device.id,
                    groupId: ''};
          }));
        });
      });
    }};
  }

  // A shim for getUserMedia method on the mediaDevices object.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return requestUserMedia(constraints);
    };
  } else {
    // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
    // function which returns a Promise, it does not accept spec-style
    // constraints.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(c) {
      webrtcUtils.log('spec:   ' + JSON.stringify(c)); // whitespace for alignment
      c.audio = constraintsToChrome(c.audio);
      c.video = constraintsToChrome(c.video);
      webrtcUtils.log('chrome: ' + JSON.stringify(c));
      return origGetUserMedia(c);
    };
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      webrtcUtils.log('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      webrtcUtils.log('Dummy mediaDevices.removeEventListener called.');
    };
  }

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    if (webrtcDetectedVersion >= 43) {
      element.srcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      webrtcUtils.log('Error attaching stream to element.');
    }
  };
  reattachMediaStream = function(to, from) {
    if (webrtcDetectedVersion >= 43) {
      to.srcObject = from.srcObject;
    } else {
      to.src = from.src;
    }
  };

} else if (navigator.mediaDevices && navigator.userAgent.match(
    /Edge\/(\d+).(\d+)$/)) {
  webrtcUtils.log('This appears to be Edge, which is not currently supported');
  webrtcDetectedBrowser = 'edge';

  webrtcDetectedVersion = webrtcUtils.extractVersion(navigator.userAgent,
      /Edge\/(\d+).(\d+)$/, 2);

  // The minimum version still supported by adapter.
  webrtcMinimumVersion = 12;
  // TODO: the latest adapter.js which was used to update this file seems to
  // contain code to support Edge.  We should look into this later.
} else {
  webrtcUtils.log('Browser does not appear to be WebRTC-capable');
}

// Returns the result of getUserMedia as a Promise.
function requestUserMedia(constraints) {
  return new Promise(function(resolve, reject) {
    getUserMedia(constraints, resolve, reject);
  });
}

var webrtcTesting = {};
try {
  Object.defineProperty(webrtcTesting, 'version', {
    set: function(version) {
      webrtcDetectedVersion = version;
    }
  });
} catch (e) {}

if (typeof module !== 'undefined') {
  var RTCPeerConnection;
  var RTCIceCandidate;
  var RTCSessionDescription;
  if (typeof window !== 'undefined') {
    RTCPeerConnection = window.RTCPeerConnection;
    RTCIceCandidate = window.RTCIceCandidate;
    RTCSessionDescription = window.RTCSessionDescription;
  }
  module.exports = {
    RTCPeerConnection: RTCPeerConnection,
    RTCIceCandidate: RTCIceCandidate,
    RTCSessionDescription: RTCSessionDescription,
    getUserMedia: getUserMedia,
    attachMediaStream: attachMediaStream,
    reattachMediaStream: reattachMediaStream,
    webrtcDetectedBrowser: webrtcDetectedBrowser,
    webrtcDetectedVersion: webrtcDetectedVersion,
    webrtcMinimumVersion: webrtcMinimumVersion,
    webrtcTesting: webrtcTesting,
    webrtcUtils: webrtcUtils
    //requestUserMedia: not exposed on purpose.
    //trace: not exposed on purpose.
  };
} else if ((typeof require === 'function') && (typeof define === 'function')) {
  // Expose objects and functions when RequireJS is doing the loading.
  define([], function() {
    return {
      RTCPeerConnection: window.RTCPeerConnection,
      RTCIceCandidate: window.RTCIceCandidate,
      RTCSessionDescription: window.RTCSessionDescription,
      getUserMedia: getUserMedia,
      attachMediaStream: attachMediaStream,
      reattachMediaStream: reattachMediaStream,
      webrtcDetectedBrowser: webrtcDetectedBrowser,
      webrtcDetectedVersion: webrtcDetectedVersion,
      webrtcMinimumVersion: webrtcMinimumVersion,
      webrtcTesting: webrtcTesting,
      webrtcUtils: webrtcUtils
      //requestUserMedia: not exposed on purpose.
      //trace: not exposed on purpose.
    };
  });
}
// End Adapter

// More WebRTC API related functions.
if (navigator.mozGetUserMedia) {  // Firefox?
  // Creates ICE server from the URL for Firefox.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create ICE server with STUN URL.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turnUrlParts = url.split('?');
        // Return null for createIceServer if transport=tcp.
        if (turnUrlParts.length === 1 ||
          turnUrlParts[1].indexOf('transport=udp') === 0) {
          iceServer = {
            'url': turnUrlParts[0],
            'credential': password,
            'username': username
          };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = {
          'url': url,
          'credential': password,
          'username': username
        };
      }
    }
    return iceServer;
  };

  window.createIceServers = function(urls, username, password) {
    var iceServers = [];
    // Use .url for FireFox.
    for (var i = 0; i < urls.length; i++) {
      var iceServer =
        window.createIceServer(urls[i], username, password);
      if (iceServer !== null) {
        iceServers.push(iceServer);
      }
    }
    return iceServers;
  };
} else if (navigator.webkitGetUserMedia) {  // Chrome?
  // Creates iceServer from the url for Chrome M33 and earlier.
  window.createIceServer = function(url, username, password) {
    var iceServer = null;
    var urlParts = url.split(':');
    if (urlParts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = {
        'url': url
      };
    } else if (urlParts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = {
        'url': url,
        'credential': password,
        'username': username
      };
    }
    return iceServer;
  };

  // Creates an ICEServer object from multiple URLs.
  window.createIceServers = function(urls, username, password) {
    return {
      'urls': urls,
      'credential': password,
      'username': username
    };
  };
}

// The PC method removeStream() is deprecated in the WebRTC spec now.
// Chrome still supports it, while Firefox has it defined with a dummy.
// Hence, create a polyfill for it, if undefined, using removeTrack().
if ((typeof window.RTCPeerConnection !== "undefined" &&
     typeof window.RTCPeerConnection.prototype.removeStream === 'undefined') ||
    webrtcDetectedBrowser === "firefox") {
  console.log("Defining RTCPeerConnection.removeStream()");
  window.RTCPeerConnection.prototype.removeStream = function(stream) {
    if (stream) {
      var self = this;
      this.getSenders().forEach(function (sender) {
        stream.getTracks().includes(sender.track) && self.removeTrack(sender); });
    }
  }
}

// MediaStream/webkitMediaStream stop() is deprecated in the WebRTC spec.
// So, create a polyfill for it for ease of use, using MediaStreamTrack.stop().
if (typeof window.MediaStream !== 'undefined' ) {
  if (typeof window.MediaStream.prototype.stop === 'undefined') {
    console.log("Defining MediaStream.stop()");
    window.MediaStream.prototype.stop = function () {
      // TODO: take/comment out the log statement below.
      //console.log("MediaStream.stop() has been called for stream ID: " + this.id);
      this.getTracks().forEach( function (track) {track.stop();} );
    }
  }
}
else if (typeof webkitMediaStream !== 'undefined' && webrtcDetectedVersion >= 45) {
  // webkitMediaStream is defined, and Chrome version is 45+.
  if (typeof webkitMediaStream.stop === 'undefined') {
    console.log("Defining webkitMediaStream.stop()");
    webkitMediaStream.prototype.stop = function () {
      // TODO: take/comment out the log statement below.
      //console.log("webkitMediaStream.stop() has been called for stream ID: " + this.id);
      this.getTracks().forEach( function (track) {track.stop();} );
    }
  }
}
// End of WebRTC API related functions.

// Generate an RSA based certificate, in case we need to use it later.
// Note, this is an asynchronous operation, and may take a second or more.
var grtcPcCertificate = null;
if (typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCPeerConnection.generateCertificate === 'function') {
  //trace("Creating certificate with RSASSA-PKCS1-v1_5");
  RTCPeerConnection.generateCertificate({
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    }).then (function(cert) {
      trace("Certificate created");
      grtcPcCertificate = cert;
    });
}

/*
 * Wrap everything in an anonymous closure and export Grtc as the only global.
 */
(function (window, navigator, document, $, undefined) {

/*jslint browser: true, bitwise: true, eqeq: false, plusplus: true, unparam: true, vars: true, white: true, maxerr: 200 */

window.onerror = function(message, url, line) {
    console.log("window.onerror: message = " + message + ", url = " + url + ", line = " + line);
};

// -------------------- Class Grtc --------------------

// This is the Grtc class and the only variable to be exported
// It is a singleton class and is not supposed to be instantiated
var Grtc = {};

// When an error is thrown by Grtc code, these are the keywords for the client
// to identify what error has happened
Grtc.CONFIGURATION_ERROR         = "CONFIGURATION_ERROR";
Grtc.CONNECTION_ERROR            = "CONNECTION_ERROR";
Grtc.WEBRTC_NOT_SUPPORTED_ERROR  = "WEBRTC_NOT_SUPPORTED_ERROR";
Grtc.WEBRTC_ERROR                = "WEBRTC_ERROR";
Grtc.INVALID_STATE_ERROR         = "INVALID_STATE_ERROR";
Grtc.NOT_READY_ERROR             = "NOT_READY_ERROR";
Grtc.GRTC_ERROR                  = "ERROR";   // Generic error
Grtc.GRTC_WARN                   = "WARNING"; // Generic warning

// The levels used by the log functions.
Grtc.LOG_LEVEL_NONE     = 0;
Grtc.LOG_LEVEL_ERROR    = 1;
Grtc.LOG_LEVEL_NOTICE   = 2;
Grtc.LOG_LEVEL_INFO     = 3;
Grtc.LOG_LEVEL_DEBUG    = 4;

/* Static method to check whether WebRTC is supported by a browser. */
Grtc.isWebrtcSupported = function () {
    if (window.mozRTCPeerConnection || window.webkitRTCPeerConnection) {
        return true;
    } else {
        return false;
    }
};

/* Static method to detect WebRTC supported browser name. */
Grtc.getWebrtcDetectedBrowser = function () {
    // use adapter variable
    return webrtcDetectedBrowser;
};

/* Static method to detect WebRTC supported browser version. */
Grtc.getWebrtcDetectedVersion = function () {
    // use adapter variable
    return webrtcDetectedVersion;
};

/* Static method to find out minimum browser version supported. */
Grtc.getWebrtcMinimumVersion = function () {
    return webrtcMinimumVersion;
};

/* Provides standard resolutions like QVGA, VGA, HD etc capsulated in constraints format
 * for user convenience.
 * For example to enable local media with audio and HD video - call the enableMediaSource() in
 * Grtc.Client like the following -
 * enableMediaSource(true,Grtc.VideoConstraints.hd());
 */
Grtc.VideoConstraints = {
    qvga: function () {
        return {
            mandatory: {
                maxWidth: 320,
                maxHeight: 180
            }
        };
    },
    vga: function () {
        return {
            mandatory: {
                maxWidth: 640,
                maxHeight: 360
            }
        };
    },
    hd: function () {
        return {
            mandatory: {
                maxWidth: 1280,
                maxHeight: 720
            }
        };
    },
    custom: function (width, height) {
        return {
            mandatory: {
                maxWidth: width,
                maxHeight: height
            }
        };
    },
    screen: function (width, height, maxframerate, minframerate) {
        if (typeof width === "undefined") {
            width = screen.width;
        }
        if (typeof height === "undefined") {
            height = screen.height;
        }
        if (typeof maxframerate === "undefined") {
            maxframerate = 5;              // Seems good enough for screen
        }
        if (typeof minframerate === "undefined") {
            minframerate = 1;
        }
        if (maxframerate < minframerate) {
            gLogger.log(Grtc.GRTC_WARN + ": Grtc.VideoConstraints.screen() - " +
                "argument maxFrameRate (" + maxframerate + ") is less than " +
                "minFrameRate (" + minframerate + ")");
            maxframerate = minframerate;
        }
        if (Grtc.getWebrtcDetectedBrowser() === 'chrome') {
            // This won't work with Chrome anymore without specifying the sourceID,
            // which should come from a Chrome extension that supports screen sharing.
            return {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    maxWidth: width,
                    maxHeight: height,
                    maxFrameRate: maxframerate,
                    minFrameRate: minframerate
                },
                optional: []
            };
        }
        else {  // Firefox - let it figure out the resolution by itself
            return {
                mediaSource: 'screen',
                frameRate: maxframerate
            };
        }
    },
    window: function (maxwidth, maxheight, maxframerate) {
        if (typeof width === "undefined") {
            maxwidth = 640;
        }
        if (typeof height === "undefined") {
            maxheight = 480;
        }
        if (typeof framerate === "undefined") {
            maxframerate = 5;              // Seems good enough for screen
        }
        if (Grtc.getWebrtcDetectedBrowser() === 'chrome') {
            return {
                mandatory: {
                    chromeMediaSource: 'screen',
                    width: maxwidth,
                    height: maxheight,
                    maxFrameRate: maxframerate
                },
                optional: []
            };
        }
        else {  // Firefox
            return {
                mediaSource: 'window',
                //width: maxwidth,
                //height: maxheight,
                frameRate: maxframerate
            };
        }
    }
};

/* Decode a query-string into an object and return it. */
Grtc.deparam = function(query) {
    var params = {},
        seg = query.replace(/\n/g,'').split('&'),
        len = seg.length, i, s;
    for (i = 0; i < len; i++) {
        if (seg[i] && seg[i].search("=") > 0) {
            s = seg[i].split('=');
            params[s[0]] = s[1];
        }
    }
    return params;
};

// -------------------- Utility functions --------------------

/* Utility (private) function to generate a 36-character sequence. */
function generateUUID () {
    var maxInt = 2147483647; // Math.pow(2,31)-1
    // Number of milliseconds since 1970-01-01 (should be greater than maxInt)
    var timestamp = new Date().getTime();
    var uuid = "anonxxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g,
        function (c) {
            // Takes the 4 least significant bits of timestamp (plus a random additive)
            var randomN = (timestamp + Math.random()*maxInt) & 0xf;
            // Prepare for the next round (note: using shift operator may cause
            // lost of information since shift in javascript works on 32bit number
            // and timestamp is greater than that)
            timestamp = timestamp / 2 | 0;
            // Replace x with randomN and y with 1--- where - is one of the
            // 3 least significant bits of randomN (use base16 representation)
            return (c === "x" ? randomN : (randomN & 0x7 | 0x8)).toString(16);
        }
    );
    return uuid;
}

// -------------------- Class Grtc.Logger --------------------

/* Logger class used to log error messages.
 * Not making it a closure since there is not much to encapsulate. */
Grtc.Logger = function (e) {
    // The HTML container element the logs should be sent to.
    // If set to null or invalid, logs are sent to web console by default
    this.element = null;
    if (e && e.nodeType) {
        this.element = e;
    }
};

/* Log message to the container element if valid; otherwise log to console.
 * If exception object is specified, its description field is also logged. */
Grtc.Logger.prototype.log = function (message, exception) {
    var s = "grtc";
    if (window.performance && window.performance.now) {
        s += (": " + (window.performance.now() / 1000).toFixed(3));
    }
    if (message) {
        s += (": " + message);
    }
    if (exception && exception.message) {
        s += (": " + exception.message);
    }

    if (this.element && (typeof this.element.innerHTML === "string")) {
        this.element.innerHTML += (s + "<br/>");
    } else if (gExtLogger) {
        gExtLogger.info(s);
    } else {
        if (window.console && window.console.log) {
            window.console.log(s);
        }
    }
};

// default logger used by Grtc internally
var gLogger     = new Grtc.Logger();
var gExtLogger  = null;

/* User can set gLogger to another instance of Grtc.Logger. */
Grtc.setLogger = function (logger) {
    if (logger && (logger.constructor === Grtc.Logger)) {
        gLogger = logger;
    }
};

/* User can set custom log4js logger. */
Grtc.setExternalLogger = function (logger) {
    if (logger && (typeof logger.info === "function")) {
        gExtLogger = logger;
    }
};

// -------------------- END of Class Grtc.Logger --------------------

// -------------------- Class Grtc.Error --------------------

/* Error class used to customize errors thrown by Grtc functions.
 * Not making it a closure since there is not much to encapsulate. */
Grtc.Error = function (t, m) {
    this.name = (typeof t === "undefined") ? Grtc.GRTC_ERROR : t;
    this.message = "";
    if (m) {
        this.message = m;
    }
};

// -------------------- END of Class Grtc.Error --------------------

// Call state values. Currently only two are really needed.
var CALL_STATE_IDLE        = 0; // Call is not started or disconnected.
var CALL_STATE_ACCEPTED    = 1; // Call has been accepted by the user.
var CALL_STATE_STARTED     = 2; // Call session negotiation has started.
var CALL_STATE_CONNECTED   = 3; // Call is connected.

// -------------------- Class Grtc.Client ---------------------------

/*
 * The Grtc Client class represents a user agent (browser) that can
 * register/connect/disconnect against the WebRTC gateway with a SIP Server,
 * and make a call to a client or SIP endpoint that has registered with
 * the SIP Server, or accept a call from another client or SIP endpoint.
 * Register involves registering with the SIP Server via the gateway,
 * while connect uses an arbitrary UUID to register with the gateway only.
 * To be able to receive a call, you would need to use register.
 *
 * The client could only manage one register or connect at a time, though it
 * allows disconnecting and registering/connecting again with a different ID.
 * It could also manage only one call at a time, though another call could be
 * made after terminating the the existing call.  Multiple concurrent calls
 * require multiple instances of the grtc client, however.
 *
 * This class is encapsulated in an anonymous closure and exported as a
 * property of Grtc.  The following member variables are used.
 *
 * - configuration: contains a list of mandatory and optional properties
 *     used to establish connection with the WebRTC gateway.
 * - localStream  : local audio and/or video stream obtained via getUserMedia.
 * - publicId     : a unique ID for connecting with the gateway anonymously.
 * - registeredSSID: unique Server-Side ID received from Gateway on sign-in.
 * - mediaSession : a reference to the Grtc.MediaSession instance.
 * - pcCaller     : caller ID of incoming call, available till call is handled;
 *     if call is accepted, this ID will be set in pcDest of mediaSession.
 * - incomingMsg  : incoming offer message, processed by mediaSession.acceptCall.
 * - audioConstraints/videoConstraints: media constraints used with getUserMedia,
 *     and could be optionally set by enableMediaSource.
 * - noansTimeout : no-answer timeout value, which can be set in configuration.
 * - disconnecting: a flag indicating that a disconnect is in progress.
 */
(function () {

var GRTC_PARAMETERS = [
    "webrtc_gateway",
    "stun_server",
    "turn_server",
    "turn_username",
    "turn_password",
    "sip_username",
    "sip_password",
    "dtls_srtp",
    "enable_ipv6",
    "noanswer_timeout",
    "ice_timeout",
    "ice_optimization",
    "polling_timeout",
    "use_rsa_certificate"
];

// This is the Grtc.Client class to be exported
var gClient = function (configObj) {
    gLogger.log("Grtc version: " + GRTC_VERSION);   // Log the version info.

    // configObj is the configuration object that should contain some
    // mandatory properties and optional properties. Need to check it
    // is well formed
    var isWellFormed = true;
    if (configObj && typeof configObj === "object") {
        // "webrtc_gateway" is mandatory
        if (!configObj.hasOwnProperty("webrtc_gateway")) {
            gLogger.log(Grtc.CONFIGURATION_ERROR +
                ": mandatory parameter is not specified: webrtc_gateway");
            isWellFormed = false;
        }

        // turn_username and turn_password needed when turn_server is specified
        if (configObj.hasOwnProperty("turn_server")) {
            if (!configObj.hasOwnProperty("turn_username")) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter must be specified: turn_username");
                isWellFormed = false;
            }
            if (!configObj.hasOwnProperty("turn_password")) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter must be specified: turn_password");
                isWellFormed = false;
            }
        }

        // each property defined in configObj shall be valid
        var p;
        for (p in configObj) {
            if ($.inArray(p, GRTC_PARAMETERS)<0) {
                gLogger.log(Grtc.CONFIGURATION_ERROR +
                    ": parameter specified is not valid: " + p);
                isWellFormed = false;
            }
        }
    } else {
        isWellFormed = false;
    }

    if (isWellFormed) {
        this.configuration = configObj;
    } else {
        gLogger.log(Grtc.CONFIGURATION_ERROR +
            ": configuration object is not well formed");
        throw new Grtc.Error(Grtc.CONFIGURATION_ERROR,
            "configuration object is not well formed");
    }

    // Log level - increase it for more verbose logging.
    this.logLevel = Grtc.LOG_LEVEL_INFO;

    // Local audio and/or video stream object obtained lastly via getUserMedia.
    this.localStream = null;

    // An arbitrary unique ID for connecting with the gateway anonymously.
    this.publicId = generateUUID();

    // Unique Server-Side ID received from Gateway on sign-in.
    this.registeredSSID = -1;

    this.hangingGetTimer = null;

    // The Grtc.MediaSession instance used for a media call.
    this.mediaSession = null;

    // Set to "true" for renewing/recreating the PeerConnection on every new incoming
    // or outgoing offer. This will redo ICE and DTLS, but is required when session
    // renegotiation is not supported, as was the case earlier (<v38) with Firefox.
    // NOTE: This can be set using setRenewSessionOnNeed() method, though support for
    // this in the gateway needs to be enabled too.
    this.renewPConNewOffer = false;

    // Audio/video constraints that are used when making an offer or answer.
    // These could be changed using the methods setMediaConstraintsForOffer() and
    // setMediaConstraintsForAnswer().
    this.offerToReceiveAudioInOffer  = true;
    this.offerToReceiveVideoInOffer  = true;
    this.offerToReceiveAudioInAnswer = true;
    this.offerToReceiveVideoInAnswer = true;

    // Indicates if a call is idle, accepted, started, or connected.
    this.callState = CALL_STATE_IDLE;

    // Caller ID of an incoming call, available till call is processed.
    this.pcCaller = null;

    // Used to save an incoming offer message, which is to be processed by
    // the onIncomingCall handler by calling acceptCall() on the mediaSession.
    this.incomingMsg = null;

    // Set to true when the call is on-hold.  Ideally, it should be in mediaSession.
    // However, it has been moved here to allow creating a new mediaSession for
    // the same call (for e.g., to workaround renegotiation issues).
    this.onHold = false;

    // Default access permissions to local audio and video streams.
    // These could be optionally overwritten by enableMediaSource().
    this.audioConstraints = true;
    this.videoConstraints = true; //{"mandatory": {}, "optional": []};

    // Video bandwidth value to be set in SDP using b=AS field. It's in Kbps.
    // Note: setting this may not work with Firefox currently.
    this.bandwidthVideo = 500;

    // Set to true if new ICE candidates are expected due to a media type added
    // for the first time using gUM. It's used to avoid a Chrome (v33) bug with
    // iceGatheringState, which seems fixed in Canary v35.
    this.candidatesExpected = false;
    // These remember if audio/video is enabled at least once - used for setting
    // candidatesExpected.
    this.audioEnabledOnce = false;
    this.videoEnabledOnce = false;

    // Minimum noanswer from peer timeout is set to 18s (3-rings).
    // Default for this configuration is set to 60s.
    this.noansTimeout = 60000;
    if (configObj.hasOwnProperty("noanswer_timeout")) {
        var temp = parseInt(configObj.noanswer_timeout, 10);
        if ($.isNumeric(temp) && temp >= 18000) {
            this.noansTimeout = temp;
        }
    }

    // Default for ICE gathering timeout is set to 1s.
    // Should not allow to be set to less than 1s.
    // The upper limit doesn't matter as the timer will
    // be reset if ICE gathering from the browser side is
    // completed.
    this.iceGatheringTimeout = 1000;
    if (configObj.hasOwnProperty("ice_timeout")) {
        var temp = parseInt(configObj.ice_timeout, 10);
        if ($.isNumeric(temp) && temp >= 1000) {
            this.iceGatheringTimeout = temp;
        }
    }

    // For HTTP long-polling the timeout for hanging GET is set to 30s
    // by default. This is added to quickly detect if there is any
    // network connection issue between the client and the gateway.
    // Otherwise if the connection is broken it would still take
    // longer for TCP connect timeout to trigger. The minimum allowed
    // value should be no less than 10s.
    this.pollingTimeout = 30000;
    if (configObj.hasOwnProperty("polling_timeout")) {
        var temp = parseInt(configObj.polling_timeout, 10);
        if ($.isNumeric(temp) && (temp === 0 || temp >= 10000)) {
            this.pollingTimeout = temp;
        }
    }

    this.uceIceOptimization = false;
    if (configObj.hasOwnProperty("ice_optimization")) {
        if(configObj.ice_optimization) {
            this.uceIceOptimization = true;
        }
    }

    // Note, certificate generation can potentially take a second or more;
    // therefore, grtcPcCertificate may not be set to the RSA certificate yet.
    this.useRsaCertificate = false;
    if (configObj.hasOwnProperty("use_rsa_certificate")) {
        if(configObj.use_rsa_certificate) {
            this.useRsaCertificate = true;
        }
    }

    this.disconnecting = false;     // True when a disconnect is in progress.

    // This is used to reset necessary member variables, when a call ends.
    // It is important to keep the value of these variables, when mediaSession
    // is re-created on each new offer or answer for the same call.
    this.resetGrtcOnCallEnd = function() {
        //this.mediaSession = null;
        this.callState    = CALL_STATE_IDLE;
        this.pcCaller     = null;
        this.incomingMsg  = null;
        this.onHold       = false;
    }

    // The following callback events are supported. One or more handlers could
    // be added with each of these by the user to handle the associated event.
    // The "unique" flag makes sure a function is not added multiple times,
    // while "stopOnFalse" avoids calling functions added later when one
    // returns false (calling order is the same as the added order).
    this.onConnect          = $.Callbacks("unique stopOnFalse");
    this.onRegister         = $.Callbacks("unique stopOnFalse");
    this.onFailed           = $.Callbacks("unique stopOnFalse");
    this.onDisconnect       = $.Callbacks("unique stopOnFalse");
    this.onIceDisconnected  = $.Callbacks("unique stopOnFalse");
    this.onConnectionError  = $.Callbacks("unique stopOnFalse");
    this.onMediaSuccess     = $.Callbacks("unique stopOnFalse");
    this.onMediaFailure     = $.Callbacks("unique stopOnFalse");
    this.onIncomingCall     = $.Callbacks("unique stopOnFalse");
    this.onCallEvent        = $.Callbacks("unique stopOnFalse");
    this.onNotifyEvent      = $.Callbacks("unique stopOnFalse");
    this.onPeerClosing      = $.Callbacks("unique stopOnFalse");
    this.onPeerNoanswer     = $.Callbacks("unique stopOnFalse");
    this.onInfoFromPeer     = $.Callbacks("unique stopOnFalse");
    this.onStatsFromServer  = $.Callbacks("unique stopOnFalse");
    this.onGatewayError     = $.Callbacks("unique stopOnFalse");
    this.onWebrtcError      = $.Callbacks("unique stopOnFalse");
};

/* Set the log verbose level. */
gClient.prototype.setLogLevel = function (logLevel) {
    if (typeof logLevel === "number" && logLevel >= 0 && logLevel <= 4) {
        this.logLevel = logLevel;
        this.logNotice("Log verbose level set to " + logLevel);
    }
    else {
        gLogger.log(Grtc.GRTC_ERROR + " : Invalid log level: " + logLevel +
            "; using default value " + this.logLevel + " (valid range is 0 - 4)");
    }
}

/* Convenient log functions, that log based on the log level. */
gClient.prototype.logError = function (message, exception) {
    if (this.logLevel >= Grtc.LOG_LEVEL_ERROR) {
        gLogger.log(message, exception);
    }
}

gClient.prototype.logNotice = function (message, exception) {
    if (this.logLevel >= Grtc.LOG_LEVEL_NOTICE) {
        gLogger.log(message, exception);
    }
}

gClient.prototype.logInfo = function (message, exception) {
    if (this.logLevel >= Grtc.LOG_LEVEL_INFO) {
        gLogger.log(message, exception);
    }
}

gClient.prototype.logDebug = function (message, exception) {
    if (this.logLevel >= Grtc.LOG_LEVEL_DEBUG) {
        gLogger.log(message, exception);
    }
}

/* Send the sign_in request: common for connect and register. */
function doConnect (objClient) {
    var objGet = null;
    try {
        var queryurl = objClient.configuration.webrtc_gateway +
            "/sign_in?" + objClient.publicId;
        objClient.logNotice("Signing in Conect: " + queryurl);
        objGet = $.get(queryurl, function (data) {
            try {
              alert("Hola")
                var peers = data.split("\n");
                console.log(peers)
                objClient.registeredSSID = peers[0].split("=")[1];
                objClient.logInfo("Server-Side ID: " + objClient.registeredSSID);
                startHangingGet(objClient, objClient.registeredSSID);
            } catch (e) {
                // Originally thought throwing an error here is sufficient.
                // It turned out not working since we do not control who
                // triggers "onreadystatechange" event (guess the browser?)
                // so the error was not caught properly

                // So instead, we can notify the client by firing an event;
                // and the client is expected to handle the event by notifying
                // the user about the error

                // One method is to use DOM events handling:
                // createEvent/initEvent/dispatchEvent plus client side
                // handling using addEventListener. The jQuery equivalent
                // are methods trigger/on

                // To avoid DOM events on the library side, it is recommended to use
                // $.Callbacks plus fire/add in jQuery
                objClient.logError("Connection attempt to WebRTC Gateway has failed", e);
                objClient.onFailed.fire({
                    message: "Connection attempt to WebRTC Gateway has failed"
                });
            }
        });
    } catch (e) {
        objClient.logError(Grtc.CONNECTION_ERROR + ": sign-in failed", e);
        throw new Grtc.Error(Grtc.CONNECTION_ERROR, "exception during sign-in");
    }
    return objGet;
}

/* Send the sign_in request: common for connect and register. */
function doAuthenticate (objClient) {
    var objGet = null;
    try {
        var queryurl = objClient.configuration.webrtc_gateway + "/sign_in";
        var postData = objClient.publicId + ":" + objClient.configuration.sip_password;
        objClient.logNotice("Signing in Register: " + queryurl); // we don't print password
        objGet = $.post(queryurl, postData, function (data) {
            try {
                var peers = data.split("\n");
                objClient.registeredSSID = peers[0].split("=")[1];
                objClient.logInfo("Server-Side ID: " + objClient.registeredSSID);
                startHangingGet(objClient, objClient.registeredSSID);
            } catch (e) {
                // Originally thought throwing an error here is sufficient.
                // It turned out not working since we do not control who
                // triggers "onreadystatechange" event (guess the browser?)
                // so the error was not caught properly

                // So instead, we can notify the client by firing an event;
                // and the client is expected to handle the event by notifying
                // the user about the error

                // One method is to use DOM events handling:
                // createEvent/initEvent/dispatchEvent plus client side
                // handling using addEventListener. The jQuery equivalent
                // are methods trigger/on

                // To avoid DOM events on the library side, it is recommended to use
                // $.Callbacks plus fire/add in jQuery
                objClient.logError("Connection attempt to WebRTC Gateway has failed", e);
                objClient.onFailed.fire({
                    message: "Connection attempt to WebRTC Gateway has failed"
                });
            }
        });
    } catch (e) {
        objClient.logError(Grtc.CONNECTION_ERROR + ": authentication failed", e);
        throw new Grtc.Error(Grtc.CONNECTION_ERROR, "exception during authentication");
    }
    return objGet;
}

/* Connect to WebRTC gateway using a arbitrary UUID. */
gClient.prototype.connect = function () {
    this.disconnect();      // Disconnect first, in case we are already registered.

    var self = this;

    // Send the sign_in request
    var objGet = doConnect(this);

    // Notify the client by firing an event; the client can handle the
    // event by making a call
    if (objGet) {
        objGet.done(function () {
            self.onConnect.fire({
                message: "Connection attempt to WebRTC Gateway is successful",
                id: this.registeredSSID
            });
        }).fail(function () {
            self.onFailed.fire({
                message: "Connection attempt to WebRTC Gateway has failed"
            });
            self.logError(Grtc.CONNECTION_ERROR + ": connection failed");
        });
    }
};

/* Disconnect from WebRTC gateway. */
gClient.prototype.disconnect = function () {
    doSignOut(this);

    // Reset publicId
    this.publicId = generateUUID();

    this.onDisconnect.fire({
        message: "Client is disconnected from WebRTC Gateway"
    });
};

/* register is fundamentally connect but with a user specified ID (localId argument).
 * If sip_username is specified in configuration and localId argument is not specified,
 * then sip_username is used as publicId. */
gClient.prototype.register = function (localId) {
    // Always disconnect first, in case we are already registered.
    this.disconnect();
    // The difference between register and connect is that register has a
    // user specified ID while connect is using a randomly generated ID
    if (typeof localId !== 'undefined') {
        this.publicId = localId;
    } else if (this.configuration.sip_username) {
        this.publicId = this.configuration.sip_username;
    } else {
        this.logError(Grtc.GRTC_ERROR + ": user specified id missing for registration");
        throw new Grtc.Error(Grtc.GRTC_ERROR, "user specified id missing for registration");
    }

    var self = this;

    // Send the sign_in request
    var objGet = null;
    if (!this.configuration.sip_password) {
        // authenticate
        objGet = doAuthenticate(this);
    }
 
    objGet.done(function () {
        self.onRegister.fire({
            message: "Registration attempt to WebRTC Gateway is successful"
        });
    }).fail(function () {
        self.onFailed.fire({
            message: "Registration attempt to WebRTC Gateway has failed"
        });
        self.logError(Grtc.CONNECTION_ERROR + ": registration failed");
    });
};

/* Ask the user to grant access to camera and microphone
 * audioConstraints (optional): true (default), false, or an object
 * videoConstraints (optional): true (default), false, or an object
 *
 * This functionality will be moved to MediaSession in the future. */
gClient.prototype.enableMediaSource = function (audioConstraints, videoConstraints) {
    var self = this;

    // Save user specified constraints for later use.
    // Default is true for both constraints.
    // Also, set candidatesExpected flag for Chrome version < 35, used to workaround
    // a bug that iceGatheringState in PC isn't set correct - found in version 33
    // but not 35 canary, and not sure if it's in 34; however, it should work
    // for all versions, albeit with some additional delay in response.
    // Now Firefox, at least in version 46, has a similar issue.
    var browserVersion = Grtc.getWebrtcDetectedVersion();
    this.logNotice("Browser: " + Grtc.getWebrtcDetectedBrowser() + ", version: " + browserVersion);
    if (Grtc.getWebrtcDetectedBrowser() !== "chrome" || browserVersion === null) {
        browserVersion = Infinity;
    }
    var checkCondition = (browserVersion < 35) || (Grtc.getWebrtcDetectedBrowser() === "firefox");
    if (typeof audioConstraints !== "undefined") {
        if (checkCondition) {
            if (this.audioEnabledOnce === false) {
                if (audioConstraints === true || typeof audioConstraints === "object") {
                    this.candidatesExpected = true;
                    this.audioEnabledOnce = true;
                }
            }
        }
        this.audioConstraints = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        if (checkCondition) {
            if (this.videoEnabledOnce === false) {
                if (videoConstraints === true || typeof videoConstraints === "object") {
                    this.candidatesExpected = true;
                    this.videoEnabledOnce = true;
                }
            }
        }
        this.videoConstraints = videoConstraints;
    }

    // User specified constraints will be passed to getUserMedia directly
    var mediaConstraints = {audio: this.audioConstraints, video: this.videoConstraints};
    this.logNotice("Requested access to local media with mediaConstraints: " +
                JSON.stringify(mediaConstraints));

    try {
        // Using new permission format
        navigator.getUserMedia(
            mediaConstraints,
            function (s) {
                try {
                    if (self.localStream) {
                        self.localStream.stop();
                    }
                }
                catch (e) { // Just log an error
                    self.logNotice("Stopping of local media stream failed: " + JSON.stringify(e));
                }
                self.localStream = s;
                self.logInfo("Usuario otrogó permisos de AUDIO/VIDEO");
                $(".no_media").hide();
                $(".media").fadeIn();
                $(".iniciar").removeAttr("disabled")
                self.onMediaSuccess.fire({
                    stream: s
                });
            },
            function (gumError) {
                // MWA-423: Print the specfic Error Message. With Chrome 35 DeviceNotFoundError is thrown in case of
                //          camera not available, but video constraints are set in gUM call. Also Firefox generates a
                //          different error string - NO_DEVICE_FOUND.
                var alertMsg = "Acceso a medios incompleto, verifique sus dispositivos de audio/video o modifique los permisos de uso";
                if (gumError.name) {
                    alertMsg += gumError.name;
                } else {
                    alertMsg += JSON.stringify(gumError);
                }
                self.logError(Grtc.GRTC_ERROR + ": " + alertMsg);
                self.onMediaFailure.fire({
                    message: alertMsg
                });
            }
        );
    } catch (e) {
        self.logError(Grtc.GRTC_ERROR + ": Attempt to access local media has failed", e);
        self.onMediaFailure.fire({
            message: "Attempt to access local media has failed"
        });
    }
};

/* Stop the local media source. */
gClient.prototype.disableMediaSource = function () {
    if (this.localStream !== null) {
        this.logNotice("Removing access to local media");
        if (this.mediaSession) {
            this.mediaSession.removeLocalStreams();
        }
        try {
            this.localStream.stop();
        }
        catch (e) { // Just log an error
            this.logError("Stopping of local media stream failed: " + JSON.stringify(e));
        }
        this.localStream = null;
    }
    this.candidatesExpected = false;
    this.audioEnabledOnce = false;
    this.videoEnabledOnce = false;
};

/* Set the HTML container element (sink) for the specified media stream.
 * element: the <audio> or <video> container element of the media
 * stream: the stream to be attached
 */
gClient.prototype.setViewFromStream = function (element, stream) {
    // using adapter function attachMediaStream
    return attachMediaStream(element, stream);
};

/* Filter out unneeded ICE candidates from the given list, and return the ones
 * that would be sent to the remote peer in an offer or answer message.
 * This default implementation would not filter any, and return all candidates.
 * This, however, could be overwritten by the user with another implementation.
 *
 * This is defined in client instead of media session, as it does not use
 * any member variables, and this could be overwritten in one place when the
 * client instance is created, instead of overwriting this every place where a
 * media session instance is created.
 */
gClient.prototype.filterIceCandidates = function(Candidates) {
    return Candidates;
};

/* Set the member variable that enables recreating the PeerConnection
 * on every offer or answer.
 */
gClient.prototype.setRenewSessionOnNeed = function (isEnabled) {
    if (typeof isEnabled === "boolean" ) {
        this.renewPConNewOffer = isEnabled;
        var temp = isEnabled? "enabled" : "disabled";
        this.logInfo("Option for recreating PeerConnection on every O/A: " + temp);
    }
};

/* Set "offerToReceive" constraints for audio and video that are used
 * when making an SDP offer to the peer. It is necessary to use this
 * when incoming calls without SDP offer are to be auto-answered on the
 * "talk" event with an SDP offer, or when incoming invite-for-offers,
 * after a call is established, are responded to by the JSAPI.
 */
gClient.prototype.setMediaConstraintsForOffer =
function (audioConstraints, videoConstraints) {
    if (typeof audioConstraints !== "undefined") {
        this.offerToReceiveAudioInOffer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.offerToReceiveVideoInOffer = videoConstraints;
    }
};

/* Set "offerToReceive" constraints for audio and video that are used
 * when making an SDP answer to the peer. It is necessary to use this
 * when incoming calls with SDP offer are to be auto-answered on the
 * "talk" event, or when incoming offers after a call is established
 * are responded to by the JSAPI.
 */
gClient.prototype.setMediaConstraintsForAnswer =
function (audioConstraints, videoConstraints) {
    if (typeof audioConstraints !== "undefined") {
        this.offerToReceiveAudioInAnswer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.offerToReceiveVideoInAnswer = videoConstraints;
    }
};

gClient.prototype.setVideoBandwidth = function (bandwidth) {
    if (typeof bandwidth === "number" ) {
        this.bandwidthVideo = bandwidth;
    }
};

// Export Grtc.Client
Grtc.Client = gClient;

})();

// -------------------- END of Class Grtc.Client --------------------


// -------------------- Class Grtc.MediaSession --------------------

/*
 * The MediaSession class is encapsulated in an anonymous closure and
 * exported as a property of Grtc.
 */
(function () {

var gMediaSession = function (client) {
    this.grtcClient = client;
    this.noAnswerTimer = null;
    this.iceGatheringTimer = null;
    this.sendToPeerTimer = null;
    this.peerConnection = null;

    this.initializeSession = function() {
        this.state = "new";
        this.iceConnectionState = "new";
        this.sessionId = ++Grtc.MediaSession.sessionId;
        this.otherSessionId = null;
        this.sequenceNumber = 0;
        this.pcDest = null;                     // PeerConnection destination DN
        this.actionNeeded = false;
        this.answerError = false;
        this.dataToAttach = null;
        this.dataAttached = null;
        this.isConnected = false;               // True when call is established
        this.restartICE = false;                // True if ICE restart needed
        if (this.noAnswerTimer !== null) {
            window.clearTimeout(this.noAnswerTimer);
            this.noAnswerTimer = null;
        }
        if (this.iceGatheringTimer !== null) {
            window.clearInterval(this.iceGatheringTimer);
            this.iceGatheringTimer = null;
        }
        if (this.sendToPeerTimer !== null) {
            window.clearTimeout(this.sendToPeerTimer);
            this.sendToPeerTimer = null;
            this.grtcClient.logDebug("Cleared sendToPeer timer");
        }
    }
    this.initializeSession();

    this.onRemoteStream = $.Callbacks("unique stopOnFalse");
    this.onSessionHold  = $.Callbacks("unique stopOnFalse");

    if (client) {
        client.mediaSession = this;
    }

    var conf = this.grtcClient.configuration;
    var iceServers = [];
    var iceServer = null;
    var i;
    // add stun server to the list of ice servers if it is available
    if (conf.stun_server) {
        // Fix for AACD-3748 - allow multiple STUN servers
        var stunServers = conf.stun_server.split(",");
        // using adapter function createIceServer
        for (i=0; i < stunServers.length; i++) {
            iceServer = createIceServer("stun:" + stunServers[i]);
            if (iceServer !== null) {
                iceServers.push(iceServer);
            }
        }
    }
    // add turn server to the list of ice servers if it is available
    if (conf.turn_server && conf.turn_username && conf.turn_password) {
        // Fix for AACD-3748 - allow multiple TURN servers
        // In this case the same server is used based on VCC deployment
        // with udp and tcp transport separately
        var turnServers = conf.turn_server.split(",");
        // using adapter function createIceServer
        for (i=0; i < turnServers.length; i++) {
            iceServer = createIceServer("turn:" + turnServers[i], conf.turn_username, conf.turn_password);
            if (iceServer !== null) {
                iceServers.push(iceServer);
            }
        }
    }

    // Get the Peer Connection constraints
    // - check for DTLS-SRTP config (default true)
    // - check for IPv6 config      (default false)
    var pcConstraints = {};
    var optConstraints = [];
    if ((typeof conf.dtls_srtp !== undefined) && (conf.dtls_srtp === 'false' || conf.dtls_srtp === false)) {
        optConstraints.push({"DtlsSrtpKeyAgreement": false});
    } else {
        optConstraints.push({"DtlsSrtpKeyAgreement": true});
    }
    // Chrome started supporting IPv6 from M35 onwards (Chrome issue 1406 got fixed). This optional
    // constraint is specifically used for Chrome. The default is false in Chrome.
    if ((typeof conf.enable_ipv6 !== undefined) && (conf.enable_ipv6 === 'true' || conf.enable_ipv6 === true)) {
        optConstraints.push({"googIPv6": true});
    } else {
        optConstraints.push({"googIPv6": false});
    }
    pcConstraints.optional = optConstraints;
    this.grtcClient.logInfo("PeerConnection constraints: " + JSON.stringify(pcConstraints));

    this.closePeerConnection = function() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }

    var self = this;
    this.createNewPeerConnection = function() {
        // Close any existing PC, create a new PC and set it up.
        this.closePeerConnection();

        // The following member variables are associated with a PeerConnection
        this.addedStream = null;                    // Local stream added to PC
        this.dtmfSender = null;
        this.sequenceNumber = 0;
        // The next 3 vars are currently used for a workaround to a Chrome issue
        // where ICE candidate gathering doesn't complete in some cases.
        // However, this fix could be used for general ICE optimization, and
        // could be disabled by setting grtcClient.uceIceOptimization to false.
        // Next 2 are true when corresponding stream is there, even if it's inactive.
        this.bAudioStream = false;              // True if audio stream is present
        this.bVideoStream = false;              // True if video stream is present
        // This is true if ICE checks are needed after current SDP negotiation.
        this.needIceChecks = true;
        this.iceStarted = false;
        this.moreIceComing = false;
        this.localCandidates = [];
        this.outSDP = null;

        try {
            var pcParams = {"iceServers": iceServers};
            if (grtcPcCertificate !== null && this.grtcClient.useRsaCertificate) {
              pcParams.certificates = [grtcPcCertificate];
            }
            this.grtcClient.logInfo("Creating RTCPeerConnnection with constraints: " +
                JSON.stringify(pcParams));
            this.peerConnection = new RTCPeerConnection(pcParams, pcConstraints);
        } catch (e) {
            this.grtcClient.logError(Grtc.WEBRTC_NOT_SUPPORTED_ERROR +
                ": construction of RTCPeerConnection object failed", e);
            throw new Grtc.Error(Grtc.WEBRTC_NOT_SUPPORTED_ERROR, e.message);
        }

        // ICE candidates callback
        this.peerConnection.onicecandidate = function (event) {
            if (event.candidate) {
                self.grtcClient.logInfo("ICE candidate[" + event.candidate.sdpMid + "]: " +
                        event.candidate.candidate);
                self.localCandidates.push(event.candidate);
            } else {    // Null candidate indicating end of ICE gathering.
                self.iceStarted = false;
                // Clear ICE gathering timer, if it is active.
                if (self.iceGatheringTimer !== null) {
                    window.clearInterval(self.iceGatheringTimer);
                    self.iceGatheringTimer = null;
                }
                // NOTE: At the moment, we do not renegotiate when new candidates
                // show up after the more flag has been false once.
                if (self.moreIceComing) {
                    self.grtcClient.logInfo("ICE gathering completed");
                    self.moreIceComing = false;
                    self.markActionNeeded();
                }
            }
        };

        // Fired as a result of setRemoteDescription.  Note, this has nothing to do
        // with addStream() method of peerConnection, which is used for local stream.
        // WebRTC Spec 1.0: "This callback does not wait for a given media stream to
        // be accepted or rejected via SDP negotiation."
        /* onaddstream event is deprecated - use ontrack instead.
        this.peerConnection.onaddstream = function (mediaStreamEvent) {
            try {
                gLogger.log("Access to remote stream");
                //self.onRemoteStream.fire({ stream: mediaStreamEvent.stream });
            } catch (e) {
                gLogger.log(Grtc.GRTC_ERROR + ": onRemoteStream event handling failed", e);
            }
            mediaStreamEvent.stream.onended = function () {
                gLogger.log("Remote stream ended");
            };
            mediaStreamEvent.stream.onaddtrack = function (track) {
                gLogger.log("Remote stream has changed");
                //self.onRemoteStream.fire({ stream: mediaStreamEvent.stream });
            };
        }; */
        this.peerConnection.ontrack = function (evt) {
            self.grtcClient.logInfo("Access to track - " + evt.track.kind);
        };

        this.peerConnection.onremovestream = function (mediaStreamEvent) {
            self.grtcClient.logInfo("onremovestream() called");
        };

        // Check ICE connection state to detect network disconnect
        this.peerConnection.oniceconnectionstatechange = function (iceEvent) {
            self.grtcClient.logInfo("ICE Connection State: " + self.peerConnection.iceConnectionState);
            // NOTE: On network disconnect, Chrome (M53) changes ICE state to "disconnected"
            // in 5s, and then to "failed" in 15s (instead of 30s consent expiry, as per RFC 7675)
            // - see https://bugs.chromium.org/p/webrtc/issues/detail?id=1161.
            // Firefox (50) doesn't use ICE state "disconnected", but goes directly to
            // "failed" state in 30s.
            var prevIceSt = self.iceConnectionState;
            if (self.peerConnection.iceConnectionState === "failed" &&
                (prevIceSt === "disconnected" || prevIceSt === "connected" || prevIceSt === "completed"))
            {
                self.restartICE = true;
                self.iceConnectionState = self.peerConnection.iceConnectionState;
                self.grtcClient.logError("ICE liveness check has failed. Possible network disconnect");
                self.grtcClient.onIceDisconnected.fire({ status: "ICE Failed" });
                return;
            }
            self.iceConnectionState = self.peerConnection.iceConnectionState;
        };
    }

    // Because certificate creation could take some time, delay PC creation by 1s.
    this.createNewPeerConnection();
    //window.setTimeout( function () { self.createNewPeerConnection(); }, 1000);

    // Check if the local stream has changed, and if so, update it in the PC.
    // This needs to be called before creating an offer or answer from the PC.
    this.checkAndUpdateLocalStream = function() {
        var localStream = this.grtcClient.localStream;
        if (this.addedStream === localStream) {
            return;
        }
        if (this.addedStream !== null) {
            try {
                // This stream should have been stopped when we got the new local stream.
                if (typeof this.peerConnection.removeStream === "function") {
                    this.peerConnection.removeStream(this.addedStream);
                }
            } catch (e) {
                this.grtcClient.logError(Grtc.GRTC_WARN + ": Failed to remove local stream", e);
            }
            this.addedStream = null;
        }
        try {
            this.dtmfSender = null;
            if (typeof this.peerConnection.addTrack === "function") {
                // This is in the latest WebRTC standard, as of late Dec 2016.
                // Only Firefox seems to support this at this time.
                // addStream() is deprecated, and addTrack() should be used instead.
                // Note, an RTCRtpSender is returned by addTrack, which also contains
                // RTCDTMFSender for audio tracks.  createDTMFSender() is deprecated too.
                localStream.getTracks().forEach( function(localTrack) {
                    var rtcSender = self.peerConnection.addTrack(localTrack, localStream);
                    if (localTrack.kind === "audio") {
                        self.dtmfSender = rtcSender.dtmf;
                        self.grtcClient.logInfo("Defined DTMF sender");
                    }
                });
            }
            else {
                this.peerConnection.addStream(localStream); // !! addStream is deprecated
            }
            this.addedStream = localStream;

            // Create DTMF Sender with createDTMFSender() - currently supported/used for Chrome only.
            if (this.dtmfSender === null && navigator.webkitGetUserMedia && localStream.getAudioTracks()) {
                try {
                    var local_audio_track = localStream.getAudioTracks()[0];
                    this.dtmfSender = this.peerConnection.createDTMFSender(local_audio_track);
                    this.grtcClient.logInfo("Created DTMF Sender");
                } catch (e) {
                    this.grtcClient.logError(Grtc.GRTC_ERROR + ": Failed to Create DTMF Sender", e);
                    this.dtmfSender = null;
                }
            }
        } catch (e) {
            this.grtcClient.logError(Grtc.GRTC_ERROR + ": Failed to update local stream in PC", e);
        }
    }

    this.grtcClient.onWebrtcError.add(function (obj) {
        // Just reset state, and let the app handle error in its handler.
        if (self.isConnected === false) {
            self.state = "new";
        }
        else {
            self.state = "established";
        }
        return true;
    });
};

/* Returns true if the session is established, and no renegotiation is going on. */
gMediaSession.prototype.isEstablished = function () {
    return this.state === "established";
};

/* Remove the local media streams from the PeerConnection of the media session. */
gMediaSession.prototype.removeLocalStreams = function () {
    if (this.peerConnection && this.addedStream !== null &&
        typeof this.peerConnection.removeStream === "function") {
        this.grtcClient.logInfo("Removing local streams from PC");
        try {
            this.peerConnection.removeStream(this.addedStream);
        } catch (e) {
            this.grtcClient.logError(Grtc.GRTC_WARN + ": Failed to remove local stream", e);
        }
        this.addedStream = null;
    }
};

/*
 * Sends one or multiple DTMF tones [0-9],*,#,A,B,C,D
 * tones - string composed by one or multiple valid DTMF symbols
 * options - fields in options object:
 *           duration: default 100ms. The duration cannot be more than 6000 ms or less than 70 ms.
 *           tonegap:  the gap between tones. It must be at least 50 ms. The default value is 50 ms.
 * We don't check for validity of the options fields, the WebRTC API validates this
 * returns 0 for success, -1 for failure
 */
gMediaSession.prototype.sendDTMF = function(tones, options) {
    if (this.dtmfSender === null) {
        this.grtcClient.logError("DTMF Sender is not defined");
        return -1;
    }
    if (tones === null || tones.length === 0) {
        this.grtcClient.logError("No DTMF tones specified for sending");
        return -1;
    }
    var duration = 100;
    var tonegap  = 50;
    if (options.tonegap) {
        tonegap = options.tonegap;
    }
    if (options.duration) {
        duration = options.duration;
    }
    try {
        this.dtmfSender.insertDTMF(tones, duration, tonegap);
        this.grtcClient.logInfo("DTMF tones sent: " + tones);
        return 0;
    } catch(e) {
        this.grtcClient.logError(Grtc.GRTC_ERROR + ": DTMF tone sending failed", e);
        return -1;
    }
};

/* Prepare for ICE gathering by initializing the relevant flags.
 * Note, ICE gathering starts when createOffer or createAnswer is called,
 * so this should be called before calling one of those.
 */
gMediaSession.prototype.prepareForIceGathering = function () {
    if (!this.iceStarted) {
        this.grtcClient.logInfo("ICE candidate gathering initialized");
        this.iceStarted = true;
        this.moreIceComing = true;
        // Add a timer for ICE gathering. If gathering completes before the timeout,
        // the timer will be cleared.  Otherwise, we'd mark it completed on timeout,
        // given at least one candidate is gathered. However, clear the timer now
        // if it is still active, which could happen in some situations.
        if (this.iceGatheringTimer !== null) {
            window.clearInterval(this.iceGatheringTimer);
        }
        var self = this;
        this.iceGatheringTimer = window.setInterval(
                                    function () { self.markICEGatheringTimeout(); },
                                    self.grtcClient.iceGatheringTimeout
                                 );
    }
};

/* Set video bandwidth in given SDP using b=AS:<value> field in video m-line,
 * and return the modified SDP.  Note, b= should be after c=, as per RFC 4566.
 */
function setVideoBandwidthInSDP(sdpStr, bandwidth) {
    if (bandwidth > 0) {
        return sdpStr.replace(/m=video .*\r\n([\s\S]*c=IN .*\r\n)?/mi,
                              "$&" + "b=AS:" + bandwidth + "\r\n");
    } else {
        return sdpStr;
    }
}

/* This function processes signalling messages from the other side.
 * @param {string} msgstring JSON-formatted string containing a ROAP message.
 */
gMediaSession.prototype.processSignalingMessage = function (msgstring) {
    this.grtcClient.logInfo("processSignalingMessage: " + msgstring);
    var startJSON = msgstring.search("{");
    if (startJSON > 0) {
        msgstring = msgstring.substr(startJSON);
    }
    var msg;
    try {
        msg = JSON.parse(msgstring);
    } catch (e) {
        // MWA-328: received unexpected message, ignore for now
        this.grtcClient.logNotice(Grtc.GRTC_WARN + ": JSON.parse exception ignored: ", e);
        return;
    }

    this.incomingMessage = msg;
    this.grtcClient.logInfo("processSignalingMessage(type=" +
        msg.messageType + ", seq=" + msg.seq + ", state=" + this.state + ")");

    // Handle incoming attached data
    if (msg.attacheddata) {
        this.dataAttached = msg.attacheddata;
    }

    var self = this;
    var remoteStream;
    if (this.state === "new" || this.state === "established") {
        if (msg.messageType === "OFFER") {
            this.offer_as_string = msg.sdp;
            msg.type = "offer";
            // Ideally, b=AS field should be included in the SDP by the peer.
            // However, we need to do this here, given the gateway doesn't support it.
            msg.sdp = setVideoBandwidthInSDP(msg.sdp, this.grtcClient.bandwidthVideo);
            // A HACK for Firefox - creates invalid SDP with 0 port, when a=inactive
            // is in OFFER!  See https://bugzilla.mozilla.org/show_bug.cgi?id=1015052.
            // Note, this is done when all m-lines are inactive, and done for the first media line only.
            if (Grtc.getWebrtcDetectedBrowser() === "firefox" &&
                msg.sdp.match(/a=(sendrecv|sendonly|recvonly)/i) === null) {
                msg.sdp = msg.sdp.replace(/a=inactive/i, "a=sendonly");
            }
            // A hack for the Chrome 57 issue https://bugs.chromium.org/p/webrtc/issues/detail?id=7027.
            if (Grtc.getWebrtcDetectedBrowser() === "chrome" && Grtc.getWebrtcDetectedVersion() >= 57 &&
                                                                Grtc.getWebrtcDetectedVersion() < 59) {
                msg.sdp = msg.sdp.replace(/vp8/g, "VP8");
            }
            this.grtcClient.logDebug("This is the modified remote offer SDP:\n" + msg.sdp);
            this.answerError = false;
            this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(msg),
                function () {
                    self.grtcClient.logInfo("setRemoteDescription() success");
                    self.markActionNeeded();
                },
                function (rtcErr) {
                    self.grtcClient.logError(Grtc.GRTC_ERROR +
                          ": setRemoteDescription() failed : " + rtcErr); //JSON.stringify(rtcErr));
                    self.answerError = true;
                    self.state = "offer-received-preparing-answer";
                    self.markActionNeeded();        // Send back error or bye
                }
            );

            // Check message sequence number and print warning if necessary
            if ($.isNumeric(msg.seq)) {
                if (msg.seq <= this.sequenceNumber) {
                    this.grtcClient.logNotice(Grtc.GRTC_WARN + ": OFFER message out of sequence");
                }
                this.sequenceNumber = msg.seq;
            } else {
                this.grtcClient.logNotice(Grtc.GRTC_WARN + ": OFFER message contains no valid sequence number");
            }
            this.offer_candidates = msg.Candidates;
            if (this.answerError !== true) {
                this.state = "offer-received";
            }
        } else if (msg.messageType === "OK" && this.state === "established") {
            this.grtcClient.logInfo("OK msg received");
        } else {
            this.grtcClient.logError(Grtc.CONNECTION_ERROR +
                ": incorrect message type during processSignalingMessage, " +
                "in state " + this.state +
                ", with message type " + msg.messageType);
            throw new Grtc.Error(Grtc.CONNECTION_ERROR, "Illegal message " +
                msg.messageType + " in state " + this.state);
        }
    } else if (this.state === "offer-sent") {
        if (msg.messageType === "ANSWER") {
            window.clearTimeout(this.noAnswerTimer);
            this.noAnswerTimer = null;
            msg.type = "answer";
            if ( //Grtc.getWebrtcDetectedBrowser() === "chrome" &&
                self.grtcClient.audioConstraints === false &&
                self.grtcClient.offerToReceiveAudioInOffer === false) {
                // If we had changed a=inactive to a=recvonly in audio m-line of the offer for
                // a video-only downgrade - now change a=sendonly to a=inactive in answer.
                msg.sdp = msg.sdp.replace(/(m=audio [1-9]\d* [\s\S]*)a=sendonly([\s\S]*m=video)/mi,
                    "$1" + "a=inactive" +"$2");
            }
            // This is for a SIP Server issue - see the comment where this flag is set.
            if (this.inactiveAudioFollowsVideo) {
                this.inactiveAudioFollowsVideo = false;
                msg.sdp = msg.sdp.replace(/(m=video [\s\S]*m=audio [\s\S]*)a=sendonly/mi,
                          "$1" + "a=inactive");
            }
            if (Grtc.getWebrtcDetectedBrowser() === "firefox") {
                // Firefox adds a=inactive in an offer when video is disabled, and
                // it expects the same in the answer, though m-line is disabled!
                msg.sdp = msg.sdp.replace(/m=video 0 .* \d+\r\n/i, "$&" + "a=inactive\r\n");
                msg.sdp = msg.sdp.replace(/m=audio 0 .* \d+\r\n/i, "$&" + "a=inactive\r\n");
            }
            msg.sdp = setVideoBandwidthInSDP(msg.sdp, this.grtcClient.bandwidthVideo);
            // This hack doesn't seem to be necessary - doing this on OFFERs seems to be enough.
            //msg.sdp = msg.sdp.replace(/vp8/gi, "VP8");   // Hack for Chrome 57 issue 7027.
            this.grtcClient.logDebug("This is the modified remote answer SDP:\n" + msg.sdp);
            this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(msg),
                function () {
                    self.grtcClient.logInfo("setRemoteDescription() success on answer");
                    self.onAnswerSDP(msg.sdp);
                    try {
                        remoteStream = self.peerConnection.getRemoteStreams()[0];
                        if (remoteStream) {
                            self.onRemoteStream.fire({ stream: remoteStream });
                             
                        }
                    } catch (e) {
                        self.grtcClient.logError(Grtc.GRTC_ERROR +
                            ": onRemoteStream failed with answer!", e);
                    }
                },
                function (rtcErr) {
                    var errMsg = "setRemoteDescription() of answer failed - " + rtcErr;
                    self.grtcClient.logError(Grtc.GRTC_ERROR + ": " + errMsg);
                    self.grtcClient.onWebrtcError.fire({
                        error: errMsg
                    });
                }
            );
            // Note, this needs to be done after setRemoteDescription() call.
            if (msg.Candidates) {
                this.applyCandidates(msg.Candidates);
            }
            this.state = "established";
            this.sendMessage("OK");
            this.isConnected = true;
            this.grtcClient.callState = CALL_STATE_CONNECTED;
            this.grtcClient.onCallEvent.fire({ event: "answer received" });
        } else if (msg.messageType === "OFFER") {
            // Glare processing not written yet; do nothing
            this.grtcClient.logNotice("processSignalingMessage(): Glare condition. Offer sent, expecting Answer");
            return;
        } else {
            self.grtcClient.logError(Grtc.CONNECTION_ERROR +
                ": incorrect message type during processSignalingMessage, " +
                "in state " + this.state +
                ", with message type " + msg.messageType);
            throw new Grtc.Error(Grtc.CONNECTION_ERROR, "Illegal message " +
                msg.messageType + " in state " + this.state);
        }
    }
};

/* Apply ICE candidates from remote peer to peerConnection. */
gMediaSession.prototype.applyCandidates = function (Candidates) {
    var count = Candidates.length;
    var i;
    for (i = 0; i < count; i++) {
        var candidate   = Candidates[i].candidate;
        // This is a hack for Firefox which ignores srflx candidates that don't
        // have the raddr/rport tail section (prior to RSMP 8.5.207.98) - add a dummy tail section!
        candidate = candidate.replace(/(a=candidate:.* typ srflx)$/i, "$1 raddr 192.168.0.10 rport 50000");
        var label       = Candidates[i].sdpMLineIndex;
        var mid         = Candidates[i].sdpMid;
        var iceCandDict = {sdpMLineIndex:label, sdpMid:mid, candidate:candidate};
        var iceCandidate = new RTCIceCandidate(iceCandDict);
        try {
            this.grtcClient.logInfo("addIceCandidate[" +i + "]: " + JSON.stringify(iceCandidate));
            this.peerConnection.addIceCandidate(iceCandidate);
        } catch (e) {
            // do nothing other than logging
            this.grtcClient.logNotice(Grtc.GRTC_WARN + ": could not add ICE candidate: " +
                JSON.stringify(iceCandDict), e);
        }
    }
};

/* Mark that something happened = do something later (not on this stack). */
gMediaSession.prototype.markActionNeeded = function () {
    this.actionNeeded = true;
    var self = this;
    window.setTimeout( function () { self.onstablestate(); }, 1);
};

/* Check if offer has been sent but answer is still pending after the noanswer timeout */
gMediaSession.prototype.markPeerNoanswer = function () {
    if (this.state === "offer-sent") {
        // Notify the client as no answer received from peer after offer is sent
        this.grtcClient.logNotice(Grtc.GRTC_WARN + ": answer not received from peer within " +
                                        this.grtcClient.noansTimeout + " ms");
        if (this.isConnected === false) {
            this.state = "new";
        }
        else {
            this.state = "established";
        }
        this.grtcClient.onPeerNoanswer.fire();
    }
};

/* ICE gathering timeout is hit. Check the following:
 * ICE gathering already completed;
 * ICE gathering is still on -- but at least one candidate.
 */
gMediaSession.prototype.markICEGatheringTimeout = function () {
    if (this.moreIceComing) {
        if (this.localCandidates.length > 0 || (!this.needIceChecks)) {
            this.grtcClient.logInfo("ICE gathering timeout reached");
            this.iceStarted = false;
            this.moreIceComing = false;
            window.clearInterval(this.iceGatheringTimer);
            this.iceGatheringTimer = null;
            this.markActionNeeded();
        } else {
            this.grtcClient.logInfo("Re-starting ICE gathering timer");
        }
    } else {
        window.clearInterval(this.iceGatheringTimer);
        this.iceGatheringTimer = null;
        this.grtcClient.logInfo("Cleared ICE gathering timer");
    }
};

/* Called when a stable state is entered by the browser
 * (to allow for multiple AddStream calls or other interesting actions).
 *
 * This function will generate an offer or answer, as needed, and send
 * to the remote party. */
gMediaSession.prototype.onstablestate = function () {
    this.grtcClient.logInfo("onstablestate(state=" + this.state + ")");
    var remoteStream;
    if (this.actionNeeded) {
        this.actionNeeded = false;
        try {
            if (this.state === "make-offer") {
                this.prepareForIceGathering();   // Should be called before createOffer()
                this.createOffer();
                this.state = "preparing-offer";
            } else if (this.state === "preparing-offer") {
                // If we have the ICE candidates and SDP, send the offer,
                // and set a no-answer timeout.
                if (!this.moreIceComing && this.outSDP !== null) {
                    this.sendMessage("OFFER", true);
                    this.state = "offer-sent";
                    var self = this;
                    this.noAnswerTimer = window.setTimeout(
                        function () { self.markPeerNoanswer(); },
                        self.grtcClient.noansTimeout );
                    this.grtcClient.onCallEvent.fire({ event: "offer sent" });
                }
            } else if (this.state === "offer-sent") {
                // This may happen with Firefox (without renegotiation support).
                this.grtcClient.logInfo("waiting answer");
            } else if (this.state === "offer-received") {
                this.prepareForIceGathering();   // Should be called before createAnswer()
                this.createAnswer();
                this.state = "offer-received-preparing-answer";
            } else if (this.state === "offer-received-preparing-answer") {
                if (this.answerError) {
                    this.answerError = false;
                    this.closeSession(true);    // Perhaps should support sending an error
                    this.grtcClient.onPeerClosing.fire();
                    return;
                }
                // If we have the ICE candidates and SDP, send the answer.
                if (!this.moreIceComing && this.outSDP !== null) {
                    if (this.offer_candidates) {
                        this.applyCandidates(this.offer_candidates);
                        this.offer_candidates = null;
                    }
                    try {
                        remoteStream = this.peerConnection.getRemoteStreams()[0];
                        if (remoteStream) {
                            this.onRemoteStream.fire({ stream: remoteStream });
                        }
                    } catch (e) {
                        this.grtcClient.logError(Grtc.GRTC_ERROR +
                            ": could not update remote stream on answer!", e);
                    }
                    this.sendMessage("ANSWER", true);
                    this.state = "established";
                    this.isConnected = true;
                    this.grtcClient.callState = CALL_STATE_CONNECTED;
                    this.grtcClient.onCallEvent.fire({ event: "answer sent" });
                    setTimeout(function(){ 
                      $("#video_espera").hide()
                      document.getElementById("video_espera").pause();
                      $("table").fadeIn("slow", function(){})
                    }, 3000); //IMPORTANTE
                }
            } else if (this.state === "new") {
                return;
            } else {
                this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Unexpected state " + this.state);
                //throw new Grtc.Error(Grtc.INVALID_STATE_ERROR,
                //    "Unexpected state " + this.state);
            }
        } catch (e) {
            this.grtcClient.logError(Grtc.GRTC_ERROR + ": onstablestate failed", e);
            //throw new Grtc.Error(Grtc.GRTC_ERROR, "exception during onstablestate");
        }
    }
};

/* Create an offer SDP with given hints. */
gMediaSession.prototype.createOffer = function () {
    var hints;
    if (Grtc.getWebrtcDetectedBrowser() === "firefox" && Grtc.getWebrtcDetectedVersion() >= 33) {
        // Firefox started supporting the WebRTC 1.0 spec for this parameter, starting from version 33.
        // Note the smaller case 'o' in attribute names; and this is a dictionary, not a "mandatory" constraint.
        hints = { "offerToReceiveAudio": this.grtcClient.offerToReceiveAudioInOffer,
                  "offerToReceiveVideo": this.grtcClient.offerToReceiveVideoInOffer
        };
    } else {
        hints = {"mandatory": {
            "OfferToReceiveAudio": this.grtcClient.offerToReceiveAudioInOffer,
            "OfferToReceiveVideo": this.grtcClient.offerToReceiveVideoInOffer
        }};
    }

    var self = this;
    this.grtcClient.logInfo("Create offer with constraints: " + JSON.stringify(hints));

    this.outSDP = null;
    this.checkAndUpdateLocalStream();
    this.peerConnection.createOffer(
        function (SDP) {
            // Chrome 46 started using "UDP/TLS/RTP/SAVPF" for proto, which isn't accepted
            // by RSMP yet.  Hence this workaround.
            SDP.sdp = SDP.sdp.replace(/UDP\/TLS\//gi, "");
            // Chrome doesn't throttle output bitrate if we set b=AS field in local SDP,
            // but it does if we set in peer SDP passed into setRemoteDescription.
            // However this should be done here, as it needs to be in the outgoing SDP.
            // Note, b=AS may not be supported by Firefox.
            SDP.sdp = setVideoBandwidthInSDP(SDP.sdp, self.grtcClient.bandwidthVideo);
            // This is a hack for Chrome (46?) which creates a sendonly video m-line
            // during renegotiation, given call started as a video call,
            // even though webcam/video is disabled now.
            if (self.grtcClient.videoConstraints === false &&
                SDP.sdp.match(/m=video [1-9]\d* [\s\S]*a=(sendonly)/mi) !== null)
            {
                self.grtcClient.logInfo("Disabling sendonly video in offer SDP, as videoConstraints is false\n");
                SDP.sdp = SDP.sdp.replace(/m=video \d+/i, "m=video 0");
            }
            // This is a workaround for downgrading an A+V call to video-only in Chrome;
            // otherwise SIP Server assumes hold and disables all m-lines. Later, in the
            // answer, we need to change corresponding a=sendonly to a=inactive.
            if ( //Grtc.getWebrtcDetectedBrowser() === "chrome" &&
                self.grtcClient.audioConstraints === false &&
                self.grtcClient.offerToReceiveAudioInOffer === false) {
                SDP.sdp = SDP.sdp.replace(/(m=audio [1-9]\d* [\s\S]*)a=inactive([\s\S]*m=video)/mi,
                         "$1" + "a=recvonly" +"$2");
            }
            // This is a workaround for Firefox(42), which sets a=recvonly, even though
            // offerToReceiveVideoInOffer is set to false, and no local video stream.
            if (self.grtcClient.videoConstraints === false &&
                self.grtcClient.offerToReceiveVideoInOffer === false &&
                SDP.sdp.match(/m=video [1-9]\d* [\s\S]*a=(recvonly)/mi) !== null)
            {
                self.grtcClient.logInfo("Disabling recvonly video in offer SDP, as OfferToReceiveVideo is false\n");
                SDP.sdp = SDP.sdp.replace(/m=video \d+/i, "m=video 0");
            }
            // Check if there is a hold request -- if so, set a=inactive.
            if (self.grtcClient.onHold) {
                SDP.sdp = SDP.sdp.replace(/a=(sendrecv|sendonly|recvonly)/gmi,
                                          "a=inactive");
            }
            // In a Video + Audio call (i.e., video m-line is before audio one, say due to
            // upgrade from video-only), a hold or going back to video-only causes SIP Server
            // to drop the call (due to inactive audio m-line?). Hence, this workaround.
            self.inactiveAudioFollowsVideo = false;
            SDP.sdp = SDP.sdp.replace(/(m=video [\s\S]*m=audio [\s\S]*)a=inactive/mi,
                      function(match, p1, offset, string) {
                          self.inactiveAudioFollowsVideo = true;
                          return p1 + "a=recvonly";
                      });
            // HACK for Chrome bug https://code.google.com/p/webrtc/issues/detail?id=3481.
            // Remove the rtpmap and fmtp attributes for RTX payload - we don't use RTX anyway.
            // Note, however, that RTX payload type is not removed from the m=video line itself.
            SDP.sdp = SDP.sdp.replace(/a=rtpmap:\d+ rtx\/\d+\r\n/i, "");
            SDP.sdp = SDP.sdp.replace(/a=fmtp:\d+ apt=\d+\r\n/i, "");
            // If there is no audio m-line, always add an inactive one,
            // in order to support upgrading to A+V later.
            // (Note, this couldn't be done in an answer case.)
            // This, however, doesn't help, because, when a new SDP is created
            // later with A+V, audio m-line gets ice-ufrag/pwd with empty values!
            /*if (SDP.sdp.search("m=audio") < 0) {
                SDP.sdp = SDP.sdp.replace(/m=video/i,
                          "m=audio 0 RTP/SAVPF 0\r\na=inactive\r\nm=video");
            } */
            self.outSDP = SDP;
            self.grtcClient.logInfo("createOffer success");
            self.grtcClient.logDebug("This is the modified local offer SDP:\n" + SDP.sdp);
            self.beforeSetLocal();
            var onSetLocalSuccess = self.onSetLocalSuccess.bind(self, true);
            self.peerConnection.setLocalDescription(
                SDP,
                onSetLocalSuccess,
                function (rtcErr) {
                    var errMsg = "setLocalDescription of offer failed - " + rtcErr; //JSON.stringify(rtcErr);
                    self.grtcClient.logError(Grtc.WEBRTC_ERROR +  ": " + errMsg);
                    self.grtcClient.logError("This is the offer SDP that caused failure:\n" +
                        JSON.stringify(self.outSDP));
                    self.grtcClient.onWebrtcError.fire({
                        error: errMsg
                    });
                }
            );
        },
        function (rtcErr) {
            var errMsg = "createOffer failed - " + JSON.stringify(rtcErr);
            self.grtcClient.logError(Grtc.WEBRTC_ERROR + ": " + errMsg);
            self.grtcClient.onWebrtcError.fire({
                error: errMsg
            });
        },
        hints
    );
};

/* Create an answer SDP with given hints. */
gMediaSession.prototype.createAnswer = function () {
    var hints;
    if (Grtc.getWebrtcDetectedBrowser() === "firefox" && Grtc.getWebrtcDetectedVersion() >= 33) {
        // Firefox started supporting the WebRTC 1.0 spec for this parameter, starting from version 33.
        // Note the smaller case 'o' in attribute names; and this is a dictionary, not a "mandatory" constraint.
        hints = { "offerToReceiveAudio": this.grtcClient.offerToReceiveAudioInAnswer,
                  "offerToReceiveVideo": this.grtcClient.offerToReceiveVideoInAnswer
        };
    } else {
        hints = {"mandatory": {
            "OfferToReceiveAudio": this.grtcClient.offerToReceiveAudioInAnswer,
            "OfferToReceiveVideo": this.grtcClient.offerToReceiveVideoInAnswer
        }};
    }
    var self = this;
    self.grtcClient.logInfo("Create answer with constraints: " + JSON.stringify(hints));
    this.outSDP = null;
    this.checkAndUpdateLocalStream();
    this.peerConnection.createAnswer(
        function (SDP) {
            // If video is not sent or received, set the video port to 0:
            // - This is necessary for Chrome, as it wrongly sets the direction to sendonly.
            // - This is necessary for Firefox, as, though the direction gets set
            //   correctly to "inactive", the caller waits for video, otherwise.
            //   However, since doing this for "inactive" causes issue with Chrome, take it out.
            // - Latest Firefox (v34) may not be using OfferToReceive flag for answers,
            //   as per WebRTC 1.0 spec, so we need it when this flag is false also.
            if (self.grtcClient.videoConstraints === false &&
                //SDP.sdp.match(/m=video \d+ [\s\S]*a=(sendonly|inactive)/mi) !== null)
                (SDP.sdp.match(/m=video [1-9]\d* [\s\S]*a=(sendonly)/mi) !== null ||
                 self.grtcClient.offerToReceiveVideoInAnswer === false))
            {
                self.grtcClient.logInfo("Disabling video in answer SDP, as there is no local video stream\n");
                SDP.sdp = SDP.sdp.replace(/m=video \d+/i, "m=video 0");
            }
            // If we are on-hold, don't let peer resume it by its offer.
            /* Looks like, SIP Server will take care of this - and if we do this here, some
               3PCC call-flows won't work, where SIP Server does the hold using EVENT-HOLD,
               and then resumes using re-INVITE with active SDP.
            if (self.grtcClient.onHold) {
                SDP.sdp = SDP.sdp.replace(/a=(sendrecv|sendonly|recvonly)/gmi,
                                          "a=inactive");
            } */
            SDP.sdp = setVideoBandwidthInSDP(SDP.sdp, self.grtcClient.bandwidthVideo);
            self.outSDP = SDP;
            self.grtcClient.logInfo("createAnswer success");
            self.grtcClient.logDebug("This is the modified local answer SDP:\n" + SDP.sdp);
            self.beforeSetLocal();
            var onSetLocalSuccess = self.onSetLocalSuccess.bind(self, false);
            self.peerConnection.setLocalDescription(
                SDP,
                onSetLocalSuccess,
                function (rtcErr) {
                    var errMsg = "setLocalDescription of answer failed - " + rtcErr; // JSON.stringify(rtcErr);
                    self.grtcClient.logError(Grtc.WEBRTC_ERROR + ": " + errMsg);
                    self.grtcClient.logError("This is the answer SDP that caused failure:\n" +
                        JSON.stringify(self.outSDP));
                    /* self.grtcClient.onWebrtcError.fire({
                        error: errMsg
                    }); */
                    self.answerError = true;
                    self.markActionNeeded();
                }
            );
        },
        function (rtcErr) {
            self.grtcClient.logError(Grtc.WEBRTC_ERROR + ": createAnswer failed - " +
                JSON.stringify(rtcErr));
            self.answerError = true;
            self.markActionNeeded();
        },
        hints   // This seems to have no effect on Chrome, and is replaced in the new API.
    );
};

/* To check if the call has audio stream enabled or not. */
gMediaSession.prototype.hasAudioEnabled = function () {
    return this.bAudioStream;
};

/* To check if the call has video stream enabled or not. */
gMediaSession.prototype.hasVideoEnabled = function () {
    return this.bVideoStream;
};

/* Called after getting answer to an offer, and ideally after setRemoteDescription succeeds.
*/
gMediaSession.prototype.onAnswerSDP = function (chkSDP) {
    if (chkSDP.match(/m=audio [1-9]\d* /mi) !== null) {
        this.bAudioStream = true;
    }
    else {
        this.bAudioStream = false;
    }
    if (chkSDP.match(/m=video [1-9]\d* /mi) !== null) {
        this.bVideoStream = true;
    }
    else {
        this.bVideoStream = false;
    }
    if (!this.peerConnection.getRemoteStreams()[0]) {
        // Answer received, and no remote stream means call is on-hold.
        this.onSessionHold.fire(true);
    }
};

/* Called before calling setLocalDescription on an offer or answer.
*/
gMediaSession.prototype.beforeSetLocal = function () {
    this.needIceChecks = (this.grtcClient.uceIceOptimization && !this.restartICE)? false : true;
    var audioStreamExists = this.bAudioStream;
    if (this.outSDP.sdp.match(/m=audio [1-9]\d* /mi) !== null) {
        if(!this.bAudioStream) {
            // New audio stream - ICE needs to be done.
            this.needIceChecks = true;
        }
        this.bAudioStream = true;
    }
    else {
        this.bAudioStream = false;
    }
    if (this.outSDP.sdp.match(/m=video [1-9]\d* /mi) !== null) {
        if(!this.bVideoStream) {
            // New video stream. If bundle isn't used, or audio stream
            // didn't exist, then ICE needs to be done for the video stream.
            if (!audioStreamExists ||
                this.outSDP.sdp.match(/a=group:BUNDLE/mi) === null) {
                this.needIceChecks = true;
            }
        }
        this.bVideoStream = true;
    }
    else {
        this.bVideoStream = false;
    }
};

/* Called on setLocalDescription success of an offer or answer.
*/
gMediaSession.prototype.onSetLocalSuccess = function (isOffer) {
    var iceState = this.peerConnection.iceGatheringState;
    this.grtcClient.logInfo("setLocalDescription() success - iceGatheringState: " +
                 iceState + ", isOffer: " + isOffer);
    if (!this.moreIceComing) {
        // ICE candidate gathering already completed - nothing to do.
    } else if (!this.needIceChecks) {
        this.grtcClient.logInfo("ICE checks not needed - not waiting ICE gathering");
        this.iceStarted = false;
        this.moreIceComing = false;
        this.markActionNeeded();
    } else if (iceState === "complete" && this.grtcClient.candidatesExpected === false) {
        this.grtcClient.logInfo("ICE gathering complete");
        this.iceStarted = false;
        this.moreIceComing = false;
        this.markActionNeeded();
    }
    this.grtcClient.candidatesExpected = false;
    this.restartICE = false;
    if (!isOffer && !this.peerConnection.getRemoteStreams()[0]) {
        // Answering an offer, and no remote stream means call is on-hold.
        this.onSessionHold.fire(true);
    }
};

/* Send a signalling message.
 * @param {string} operation - operation name, OFFER, ANSWER, or OK.
 * @param {string} sdp       - SDP message body. */
gMediaSession.prototype.sendMessage = function (operation, withSDP) {
    var roapMessage = {};
    roapMessage.messageType = operation;
    if (withSDP) {
        roapMessage.sdp = this.outSDP.sdp;
        var msgCandidates = [];
        // TODO: uncomment after more testing - to avoid sending candidates
        // when ICE checks are not needed.
        if (this.needIceChecks)
        {
            // Get the candidates from the SDP itself first.  FYI, with Chrome,
            // if media is upgraded from audio to a+v, then audio candidates
            // are found in SDP, and video ones will be notified using onicecandidate.
            if (roapMessage.sdp.search("a=candidate") >= 0) {
                msgCandidates = extractIceCandidatesFromSdp(roapMessage.sdp);
            }
            // Add any candidates collected from onicecandidate events.
            if (this.localCandidates.length > 0) {
                msgCandidates = msgCandidates.concat(this.localCandidates);
            }
        }
        this.localCandidates = [];
        try {
            roapMessage.Candidates = this.grtcClient.filterIceCandidates(msgCandidates);
        } catch (e) {
            this.grtcClient.logError(Grtc.GRTC_ERROR + ": filterIceCandidates() failed", e);
            roapMessage.Candidates = msgCandidates;
        }
    }
    if (operation === "OFFER") {
        roapMessage.offererSessionId = this.sessionId;
        roapMessage.answererSessionId = this.otherSessionId;  // May be null
        roapMessage.seq = ++this.sequenceNumber;
        // The tiebreaker needs to be neither 0 nor 429496725
        roapMessage.tiebreaker = Math.floor(Math.random() * 429496723 + 1);
    } else {
        roapMessage.offererSessionId = this.incomingMessage.offererSessionId;
        roapMessage.answererSessionId = this.sessionId;
        roapMessage.seq = this.incomingMessage.seq;
    }

    // Attach data if available
    if (this.dataToAttach) {
        roapMessage.attacheddata = this.dataToAttach;
    }
    this.grtcClient.logInfo("Sending ROAP message(type=" + operation + ", seq=" + roapMessage.seq +
         ", state=" + this.state + ")");
    sendToPeer(this.grtcClient, this.pcDest, "RSMP " + JSON.stringify(roapMessage), true);
};

/* Make an offer to a remote peer to establish a call or update an existing call.
   This one creates a new PeerConnection on update, given this feature is enabled.
 */
gMediaSession.prototype.doMakeOffer = function (holdMedia) {
    if (this.state !== "new" && this.state !== "established") {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Can't make an offer in state " + this.state);
        return;
    }
    if (typeof holdMedia === "boolean") {
        this.grtcClient.onHold = holdMedia;
    }
    var hints = {
        "OfferToReceiveAudio": this.grtcClient.offerToReceiveAudioInOffer,
        "OfferToReceiveVideo": this.grtcClient.offerToReceiveVideoInOffer
    };
    this.grtcClient.logNotice("Send SDP offer to " + this.pcDest + ", with hints: " + JSON.stringify(hints));
    //this.grtcClient.pcCaller = null;
    if (this.grtcClient.callState !== CALL_STATE_CONNECTED) {
        this.grtcClient.callState = CALL_STATE_STARTED;
    }
    else if (this.grtcClient.renewPConNewOffer) {
        // The call is already connected - we need to create a new PeerConnection.
        this.grtcClient.logInfo("Creating a new PeerConnection, as RenewSessionOnNeed option is enabled");
        this.createNewPeerConnection();
    }
    this.state = "make-offer";
    this.markActionNeeded();
};

/* Process an offer and send answer to establish a call or update an existing call.
   This one creates a new PeerConnection on update, given this feature is enabled.
 */
gMediaSession.prototype.processOffer = function (holdMedia) {
    if (this.state !== "new" && this.state !== "established") {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Can't process an offer in state " + this.state);
        return;
    }
    if (this.grtcClient.incomingMsg !== null) {
        if (typeof holdMedia === "boolean") {
            this.grtcClient.onHold = holdMedia;
        }
        var hints = {"mandatory": {
            "OfferToReceiveAudio": this.grtcClient.offerToReceiveAudioInAnswer,
            "OfferToReceiveVideo": this.grtcClient.offerToReceiveVideoInAnswer
        }};
        this.grtcClient.logNotice("Answer offer from " + this.pcDest +
            ", with constraints: " + JSON.stringify(hints));
        //this.grtcClient.pcCaller = null;
        if (this.grtcClient.callState !== CALL_STATE_CONNECTED) {
            this.grtcClient.callState = CALL_STATE_STARTED;
        }
        else if (this.grtcClient.renewPConNewOffer) {
            // The call is already connected - we need to create a new PeerConnection.
            this.grtcClient.logInfo("Creating a new PeerConnection, as RenewSessionOnNeed option is enabled");
            this.createNewPeerConnection();
        }
        try {
            this.processSignalingMessage(this.grtcClient.incomingMsg);
            this.grtcClient.incomingMsg = null;
        } catch (e) {
            this.grtcClient.logError(Grtc.GRTC_ERROR + ": processOffer failed", e);
            throw new Grtc.Error(Grtc.GRTC_ERROR,
                "exception during processSignalingMessage");
        }
    }
    else {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR + ": There is no offer message to process");
    }
};

// ============================================================================
// Public interface of MediaSession contains the following:
//   makeOffer
//   acceptCall
//   rejectCall
//   updateCall
//   terminateCall
//   closeSession
//   holdCall
//   resumeCall
//   setData
//   getData
// ============================================================================

/* Make an offer to a remote peer to establish a call or update an
 * existing call. In the latter case, remoteId could be set to 0.
 * The audio/video constraints could be optionally set for OfferToReceive*
 * constraints values to createOffer(); otherwise, previously set or default
 * values will be used for these.
 * "holdMedia" could be set to true or false, especially to establish a
 * call without media with a value of true. Hold and resume functions could
 * also be done on an established call using this.
 */
gMediaSession.prototype.makeOffer = function (remoteId,
                                              audioConstraints, videoConstraints,
                                              holdMedia) {
    if (this.state !== "new" && this.state !== "established") {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Can't make an offer in state " + this.state);
        return;
    }
    if (this.grtcClient.onHold && (typeof holdMedia === "boolean" && holdMedia === true)) {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Call is on hold - resume it first");
        return;
    }
    // At this point, user should have authorized local media access,
    // which determines what to send (audio/video). Before making a
    // call, the user can still control what to receive (audio/video),
    // and the constraints will be used in createOffer.
    if (typeof audioConstraints !== "undefined") {
        this.grtcClient.offerToReceiveAudioInOffer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.grtcClient.offerToReceiveVideoInOffer = videoConstraints;
    }
    // If remoteId is 0 (call is established), use current pcDest.
    if (typeof remoteId !== "undefined" && remoteId !== 0) {
        this.pcDest  = remoteId;
    }
    this.doMakeOffer(holdMedia);
};

/* Accept an incoming call - this is typically called from the onIncomingCall
 * handler. This will try to send back an ANSWER or OFFER message depending on
 * the incoming message, whether it was an OFFER or INVITE.
 * NOTE: If the call is to be automatically accepted on a "talk" event,
 * then this need not and should not be called by the application.
 */
gMediaSession.prototype.acceptCall =
function (audioConstraints, videoConstraints, remoteId, holdMedia) {
    if (this.grtcClient.callState !== CALL_STATE_IDLE) {
        this.grtcClient.logNotice(Grtc.GRTC_WARN +
            ": acceptCall is ignored - call is already answered");
        return;
    }
    // At this point, user should have authorized local media access,
    // which determines what to send (audio/video). Before making a
    // call, the user can still control what to receive (audio/video),
    // and the constraints will be used in createOffer/createAnswer.
    if (typeof audioConstraints !== "undefined") {
        this.grtcClient.offerToReceiveAudioInOffer  = audioConstraints;
        this.grtcClient.offerToReceiveAudioInAnswer = audioConstraints;
    }
    if (typeof videoConstraints !== "undefined") {
        this.grtcClient.offerToReceiveVideoInOffer  = videoConstraints;
        this.grtcClient.offerToReceiveVideoInAnswer = videoConstraints;
    }
    if (this.grtcClient.pcCaller) {
        this.pcDest = this.grtcClient.pcCaller;
        this.grtcClient.pcCaller = null;
    }
    else if (typeof remoteId !== "undefined" && remoteId !== 0) {
        this.pcDest = remoteId;
    }
    this.grtcClient.callState = CALL_STATE_ACCEPTED;
    if (this.grtcClient.incomingMsg === null) {
        this.doMakeOffer(holdMedia);
    }
    else {
        this.processOffer(holdMedia);
    }
};

/* Reject an incoming call by sending a BYE to an ID passed in or
 * saved in client.
 */
gMediaSession.prototype.rejectCall = function (remoteId) {
    if (typeof remoteId !== "undefined" && remoteId !== 0) {
        this.pcDest = remoteId;
    } else if (this.grtcClient.pcCaller) {
        this.pcDest = this.grtcClient.pcCaller;
    }
    this.grtcClient.pcCaller = null;
    this.grtcClient.incomingMsg = null;
    this.grtcClient.logNotice("Rejecting call from " + this.pcDest);
    this.closeSession(true);
};

/* Update the local media streams by setting enabled state of the streams.
 * We only support "true" and "false" for constraints; other values will be ignored.
 * Hence, this method effectively mutes or unmutes the local media.
 */
gMediaSession.prototype.updateLocalStream = function (audioConstraints, videoConstraints) {
    if (this.addedStream === null) {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR + ": Can't update local stream: there is no stream to update");
        return;
    }

    var i;
    var stream2update = this.addedStream;
    // Update audio tracks.
    if (typeof audioConstraints === "boolean") {
        var audioTrackList = stream2update.getAudioTracks();
        if (audioTrackList) {
            for (i = 0; i < audioTrackList.length; ++i) {
                if (audioTrackList[i].enabled !== audioConstraints) {
                    audioTrackList[i].enabled = audioConstraints;
                    this.grtcClient.logDebug("Audio track [" + i + "]: " + (audioConstraints ? "unmuted":"muted"));
                }
            }
        }
    }
    // Update video tracks.
    if (typeof videoConstraints === "boolean") {
        var videoTrackList = stream2update.getVideoTracks();
        if (videoTrackList) {
            for (i = 0; i < videoTrackList.length; ++i) {
                if (videoTrackList[i].enabled !== videoConstraints) {
                    videoTrackList[i].enabled = videoConstraints;
                    this.grtcClient.logDebug("Video track [" + i + "]: " + (videoConstraints ? "unmuted":"muted"));
                }
            }
        }
    }
};
/* Update the call in progress by setting the state of local media streams.
 * Note, we only support "true" and "false" for constraints values.
 */
gMediaSession.prototype.updateCall = function (audioConstraints, videoConstraints) {
    if (!this.isConnected) {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR + ": Can't update call: call not in connected state");
        return;
    }
    this.grtcClient.logNotice("Updating call with constraints: " + audioConstraints + ", " + videoConstraints);

    this.updateLocalStream(audioConstraints, videoConstraints);
};

/* Terminate a call.
   Obsoleted - use closeSession() instead.
 */
gMediaSession.prototype.terminateCall = function () {
    this.closeSession(true);
};

/* Close down the media session, and send BYE if requested.
 * However, reset the session so that it is ready to handle a new call.
 */
gMediaSession.prototype.closeSession = function (sendBye) {
    if (this.state === "new" && this.pcDest === null) {
        // Though following is not necessary usually, in some error conditions,
        // vars like sequenceNumber may need to be reset.
        this.initializeSession();
        return;
    }
    this.grtcClient.logNotice("Closing down the session");
    if (typeof sendBye === "boolean" && sendBye === true) {
        this.grtcClient.logInfo("Hanging up call by sending BYE to peer: " + this.pcDest);
        sendToPeer(this.grtcClient, this.pcDest, "BYE");
        this.grtcClient.resetGrtcOnCallEnd();
    }
    this.state = "new";
    this.pcDest = null;
    this.updateLocalStream(true, true); // In case, stream has been disabled
    this.removeLocalStreams();
    this.grtcClient.logInfo("Re-initializing the media session for possible reuse");
    this.initializeSession();
    this.createNewPeerConnection();
};

/* Hold an audio/video call. */
gMediaSession.prototype.holdCall = function () {
    if (this.state !== "established") {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR + ": Can't hold call: " +
            "call is not in established state: state is: " + this.state);
        return;
    }
    if (this.grtcClient.onHold) {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Call is already on hold");
        return;
    }
    this.grtcClient.logNotice("Putting the call on hold");
    this.doMakeOffer(true);
};

/* Resume an audio/video call. */
gMediaSession.prototype.resumeCall = function () {
    if (this.state !== "established") {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR + ": Can't resume call: " +
            "call is not in established state: state is: " + this.state);
        return;
    }
    if (!this.grtcClient.onHold) {
        this.grtcClient.logError(Grtc.INVALID_STATE_ERROR +
                    ": Can't resume call: call is not on hold");
        return;
    }
    this.grtcClient.logNotice("Resuming the call from hold");
    this.doMakeOffer(false);
};


gMediaSession.prototype.setData = function (data) {
    if (data) {
        try {
            // check if the user data is a non-empty array
            if ($.isArray(data) && data.length>0) {
                // check if each element in the array is well formed
                var isWellFormed = true;
                var i;
                
                var value = JSON.stringify(data[0].value)
                data[0].value = value.replace(/,/g, "(coma)");
                for (i=0; i<data.length; ++i) {
                    var dataElement = data[i];
                    
                    // each element should be an object
                    // and should contain exactly two properties
                    if (typeof dataElement !== "object" ||
                        Object.keys(dataElement).length !== 2 ||
                        !dataElement.hasOwnProperty("key") ||
                        !dataElement.hasOwnProperty("value")) {
                        isWellFormed = false;
                        break;
                    }
                }
                console.log(data)
                if (isWellFormed) {
                    this.dataToAttach = data;
                    console.log(data)
                    return;
                }
            }
        } catch (e) {
            // Throw at the end
            this.grtcClient.logError(Grtc.GRTC_ERROR + ": data attached is not well-formed", e);
        }
    }
    throw new Grtc.Error(Grtc.GRTC_ERROR, "Data attached is not well-formed");
};

/* Get the data item received from the OFFER message. */
gMediaSession.prototype.getData = function () {
    return this.dataAttached;
};

/* Send mid-call ROAP INFO message to the WebRTC Gateway with the input data.
 * The gateway, in turn, sends a SIP INFO message to the SIP-Server with the data
 * in the body of the message. The input data should be an object. A serialized
 * representation of the data is created (URL query string format) before sending
 * to the Gateway.
 * When mapData is set to true (or undefined), the content-type of the SIP INFO message
 * (from Gateway to SIP-Server) is set to application/x-www-form-urlencoded. In this case,
 * the SIP Server consumes the data and map it to the corresponding T-Library events.
 * Otherwise the content-type for the SIP INFO message is set to application/octet-stream
 * and the SIP-Server simply passes the message to the remote end.
 */
gMediaSession.prototype.sendInfo = function (data, mapData) {
    if (!this.isConnected) {
        this.grtcClient.logError(Grtc.GRTC_ERROR + "INFO message not sent: call is not connected yet");
        return;
    }
    if (!$.isEmptyObject(data)) {
        this.grtcClient.logDebug("INFO message input Data: " + JSON.stringify(data));
        // jQuery param() is used to convert form element values
        // into a serialized string representation
        var info = $.param(data);
        //
        if (typeof mapData !== "boolean") {
            mapData = true;
        }
        if (mapData === true) {
            this.grtcClient.logNotice("Sending INFO-MAP message");
            sendToPeer(this.grtcClient, this.pcDest, "INFO-MAP " + info);
        } else {
            this.grtcClient.logNotice("Sending INFO-PEER message");
            sendToPeer(this.grtcClient, this.pcDest, "INFO-PEER " + info);
        }
    } else {
        this.grtcClient.logError(Grtc.GRTC_ERROR + ": INFO message not sent: input data should be a non-empty object");
    }
};

gMediaSession.prototype.getServerStats = function () {
    if (!this.isConnected) {
        this.grtcClient.logError(Grtc.GRTC_ERROR + ": getServerStats: call is not connected yet");
        return;
    }
    if (!this.peerConnection) {
        this.grtcClient.logError(Grtc.GRTC_ERROR + ": getServerStats: no remote stream exists");
        return;
    }
    this.grtcClient.logNotice("Sending GET-STATS message");
    sendToPeer(this.grtcClient, this.pcDest, "GET-STATS");
};

// Export Grtc.MediaSession
Grtc.MediaSession = gMediaSession;

}) ();

// Static variable for allocating new session IDs
Grtc.MediaSession.sessionId = 101;

/* Handle a message received from peer. */
function handlePeerMessage(objClient, peer_name, msg) {
  try {
    // Note: the BYE message is sent by itself instead of in a JSON
    // object (which is the case for other messages); we might consider
    // making it consistent in the future
    if (msg.search("BYE") === 0) {
        // Other side has hung up
        objClient.logNotice("BYE received from peer " + peer_name);
        if (objClient.mediaSession) {
            objClient.mediaSession.closeSession();
        }
        // Notify the client that the peer is closing, and reset client.
        objClient.onPeerClosing.fire();
        objClient.resetGrtcOnCallEnd();
    } else if (msg.search("INVITE") === 0) {
        objClient.logNotice("INVITE message received from " + peer_name);
        // If the call has not been established yet - notify the client, which
        // should handle the event by creating a session, if necessary, and
        // accepting or rejecting the call; otherwise, send back an offer internally.
        // Note, pcDest in mediaSession will be set on makeOffer().
        if (peer_name && objClient.callState === CALL_STATE_IDLE) {
            objClient.pcCaller = peer_name;
            objClient.onIncomingCall.fire({
                peer: peer_name,
                event: "invite"
            });
        }
        else if (objClient.mediaSession) {
            objClient.onCallEvent.fire({ event: "invite received" });
            objClient.mediaSession.doMakeOffer();
        }
    } else if (msg.search("EVENT-TALK") === 0 && objClient.mediaSession) {
        objClient.logNotice("EVENT-TALK message received");
        if (objClient.callState === CALL_STATE_IDLE) {
            { //if (objClient.pcCaller !== null) {
                // A call must be waiting to be answered - need to send a response
                // using an OFFER or ANSWER message, depending on the received message.
                objClient.mediaSession.pcDest = objClient.pcCaller;
                objClient.mediaSession.acceptCall();
            }
            objClient.onNotifyEvent.fire({ event: "talk", peer: objClient.pcCaller });
        }
        else {
            // The call is on hold - take it off hold.
            objClient.mediaSession.resumeCall();
            objClient.onNotifyEvent.fire({ event: "talk", peer: peer_name });
        }
    } else if (msg.search("EVENT-HOLD") === 0) {
        objClient.logNotice("EVENT-HOLD message received");
        if (objClient.mediaSession) {
            objClient.mediaSession.holdCall();
            objClient.onNotifyEvent.fire({ event: "hold", peer: peer_name });
        }
    } else if (msg.search("INFO-PEER ") === 0) {
        // Notify the client with the data received with the message.
        // The data may be serailized - so conversion needed
        try {
            objClient.logNotice("INFO-PEER message received");
            objClient.logInfo("INFO-PEER message received with data: " + msg.substr(10));
            var data = Grtc.deparam(msg.substr(10));
            objClient.onInfoFromPeer.fire(data);
        } catch (e) {
            objClient.logError(Grtc.GRTC_ERROR +
                ": handlePeerMessage failed for INFO-PEER", e);
        }
    } else if (msg.search("PUT-STATS") === 0) {
        // Notify the client with the stats received from peer.
        var jsonStats;
        try {
            jsonStats = JSON.parse(msg.substr(9));
            objClient.logNotice("PUT-STATS message received");
            objClient.logInfo("PUT-STATS message received with data: " + JSON.stringify(jsonStats));
            objClient.onStatsFromServer.fire(jsonStats);
        } catch (e) {
            objClient.logError(Grtc.GRTC_ERROR + ": handlePeerMessage failed for PUT-STATS", e);
            objClient.logError("This is the message:\n" + msg.substr(9));
        }
    } else if (msg.search("ERROR") > 0 && msg.search("errorType") > 0 && msg.search("{") > 0) {
        // Print error message received from the gateway.
        // Also, fire onGatewayError event to let the application decide.
        // Currently, we don't send error specific text from the gateway, only
        // the error type is populated.
        var json, jsonObj, errType;
        try {
            json    = msg.substr(msg.search("{"));
            jsonObj = JSON.parse(json);
            errType = jsonObj.errorType;
            objClient.logError(Grtc.GRTC_ERROR + ": message received from the Gateway: " + errType);
            objClient.onGatewayError.fire({
                error: errType
            });
        } catch (e) {
            objClient.logError(Grtc.GRTC_WARN + ": exception for parsing error message: " + msg, e);
        }
    } else {
        // For offer, always fire onIncomingCall, and let the app decide if it
        // wants to reuse the existing media session, if any, or create one.
        var offsetOffer = msg.search("OFFER");
        if (objClient.mediaSession && offsetOffer < 0) {
            try {
                objClient.mediaSession.processSignalingMessage(msg);
            } catch (e) {
                objClient.logError(Grtc.GRTC_ERROR +
                    ": handlePeerMessage failed", e);
            }
        } else if (msg.search("SDP") === 0 && offsetOffer > 0 && peer_name) {
            objClient.logNotice("OFFER received from peer " + peer_name);
            // An offer message - save the info in client, and process the message.
            // If the call has not been established yet - notify the client, which
            // should handle the event by creating a session, if necessary, and
            // accepting or rejecting the call; otherwise, send back an answer internally.
            objClient.incomingMsg = msg;
            if (objClient.callState === CALL_STATE_IDLE) {
                // Ideally, peer name should be passed back into acceptCall/rejectCall.
                objClient.pcCaller = peer_name;
                objClient.onIncomingCall.fire({
                    peer: peer_name,
                    event: "offer"
                });
            }
            else if (objClient.mediaSession) {
                objClient.onCallEvent.fire({ event: "offer received" });
                objClient.mediaSession.processOffer();
            }
        }
        else {
            objClient.logNotice(Grtc.GRTC_WARN + ": unexpected message received:\n" + msg);
        }
    }
  } catch (e) {
    // We don't want to throw the exception back to startHangingGet.
    objClient.logError(Grtc.GRTC_ERROR +  ": handlePeerMessage failed", e);
  }
}

/* Start a hanging GET with the WebRTC gateway, with a timeout. On normal response, or
   timeout, it will be restarted immediately.  On error, it will be restarted in 3s.
   Note that the gateway uses the response for sending messages to the client.
   This polling starts on sign-in, and continues until sign-out. */
function startHangingGet(objClient, usedSSID, isTimer) {
    if (objClient.registeredSSID === -1 || objClient.registeredSSID !== usedSSID) {
        return;
    }
    objClient.hangingGetTimer = null;
    try {
        var queryurl = objClient.configuration.webrtc_gateway +
                        "/wait?id=" + objClient.registeredSSID;
        $.ajax({url: queryurl, timeout: objClient.pollingTimeout})
        .done(queryurl, function (data, textStatus, jqXHR) {
            // You can access readyState/status/data via jqXHR
            try {
                if (objClient.disconnecting || objClient.registeredSSID !== usedSSID) {
                    return;
                }

                if (jqXHR.status !== 200) {
                    doSignOut(objClient);
                    objClient.onPeerClosing.fire();
                } else {
                    var peer_name = jqXHR.getResponseHeader("Pragma");
                    handlePeerMessage(objClient, peer_name, jqXHR.responseText);
                    window.setTimeout(function() { startHangingGet(objClient, usedSSID, true); }, 0);
                }
            } catch (e) {
                if (typeof isTimer === "boolean" && isTimer === true) {
                    objClient.logError(Grtc.GRTC_ERROR + ": startHangingGet", e);
                } else {
                    throw e;
                }
            }
        })
        .fail(function (jqXHR, textStatus) {
            jqXHR.abort();
            if (objClient.disconnecting || objClient.registeredSSID !== usedSSID) {
                return;
            }
            if (textStatus === "timeout") {
                objClient.logDebug("Hanging get timed out - restarting it");
                window.setTimeout(function() { startHangingGet(objClient, usedSSID, true); }, 0);
            }
            else // (textStatus === "error")
            {
                objClient.logInfo("Hanging get failed: " + textStatus + " - will retry after 3s");
                objClient.hangingGetTimer =
                    window.setTimeout(function() { startHangingGet(objClient, usedSSID, true); }, 3000);
                objClient.onConnectionError.fire({ status: textStatus });
            }
        });
    } catch (e) {
        objClient.logError(Grtc.GRTC_ERROR + ": startHangingGet failed", e);
        if (typeof isTimer === "undefined" || isTimer === false) {
            throw new Grtc.Error(Grtc.GRTC_ERROR, "exception during startHangingGet");
        }
    }
}

/* Send message to peer. */
function sendToPeer(objClient, peer_id, data, doRetry, isRetry) {
    if (objClient.registeredSSID !== -1) {
        // If it is a retry, don't send this, provided the media session is done.
        if (typeof isRetry === "boolean" && isRetry) {
            if (objClient.mediaSession === null || objClient.mediaSession.pcDest === null) {
                return;
            }
            objClient.mediaSession.sendToPeerTimer = null;
            // If it's an OFFER message, restart the no-answer timer.
            if (objClient.mediaSession.state === "offer-sent") {
                window.clearTimeout(objClient.mediaSession.noAnswerTimer);
                objClient.mediaSession.noAnswerTimer = window.setTimeout(
                        function () { objClient.mediaSession.markPeerNoanswer(); },
                        objClient.noansTimeout );
            }
            
        }
        
        if (peer_id === "self") {
            peer_id = objClient.registeredSSID;
        }
        var gateway = objClient.configuration.webrtc_gateway;
        var queryurl = gateway + "/message?from=" + objClient.registeredSSID +
                        "&to=" + peer_id;
        var jqhxr = $.ajax({url: queryurl, type: 'POST', data: data})
        .done(function (data, textStatus, jqXHR) {
            if (jqXHR.status !== 200) {
                objClient.logInfo("sendToPeer returned " + jqXHR.status);
            }
        })
        .fail(function (jqXHR, textStatus) {
            jqXHR.abort();
            // Retry sending, if requested, but only if media session is still connected.
            if (objClient.mediaSession !== null && objClient.mediaSession.pcDest !== null &&
                typeof doRetry === "boolean" && doRetry) {
                objClient.logInfo("sendToPeer failed: " + textStatus + " - will retry after 3s");
                objClient.mediaSession.sendToPeerTimer =
                    window.setTimeout(function() { sendToPeer(objClient, peer_id, data, true, true); }, 3000);
            }
        });
        return jqhxr;
    }
    return null;
}

/* Sign out from WebRTC gateway. */
function doSignOut(objClient) {
    // Cleanup all active connections (if applicable) and then sign out.
    var gateway = objClient.configuration.webrtc_gateway;

    if (objClient.mediaSession !== null) {
        objClient.mediaSession.closeSession(true);
    }
    objClient.disconnecting = true;
    if (objClient.registeredSSID !== -1) {
        objClient.logNotice("Signing out of the WebRTC Gateway");
        var queryurl = gateway + "/sign_out?id=" + objClient.registeredSSID;
        // Currently no specific handling if a sign_out request fails -
        // the client will just quit.
        $.get(queryurl);
        objClient.registeredSSID = -1;
    }
    objClient.disconnecting = false;
    // This should be after registeredSSID is set to -1 to avoid a possible race condition.
    if (objClient.hangingGetTimer !== null) {
        window.clearTimeout(objClient.hangingGetTimer);
        objClient.hangingGetTimer = null;
        objClient.logDebug("Cleared hanging GET timer");
    }
}

/* Extract ICE candidates from an SDP string, and return an array of candidates
   that are in RTCIceCandidate format. Note, currently in the case of FireFox,
   the ICE candidates are always in the SDP.  With Chrome, candidates are found
   in the SDP on renegotiation cases only.
 */
function extractIceCandidatesFromSdp(sdp) {
    var sdpLines = sdp.split('\r\n');
    var sdpMLineIndex = -1;
    var sdpMid = "";
    var candidates = [ ];
    var i;
    for (i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
            sdpMLineIndex += 1;
            sdpMid = "audio";
        } else if (sdpLines[i].search('m=video') !== -1) {
            sdpMLineIndex += 1;
            sdpMid = "video";
        } else if (sdpLines[i].search('a=candidate') !== -1) {
            var candidate = {};
            candidate.sdpMLineIndex = sdpMLineIndex;
            candidate.sdpMid = sdpMid;
            candidate.candidate = sdpLines[i]; //+ '\r\n';
            candidates.push(candidate);
        }
    }
    return candidates;
}

// Export Grtc
window.Grtc = Grtc;

})(window, navigator, document, jQuery);
