

/**********************************************************************************************************************************************
***********************************************************************************************************************************************
***********************************************************************************************************************************************/
$("#video_window,.web, .media, table, #video_espera").hide();



$("#check").click(function(){
	$("#video_window").show();
  if(check() ==  true){
    setTimeout(function(){ 
      $(".no_available.no_web").hide();
      $(".web").fadeIn();
    }, 1500);
  }
  crearCliente()
  habilitarMedios();
  register()
})


$(".fa-times-circle-o").click(function(){
	$("#video_window").hide();
})

$(".iniciar").click(function(){
  $(".previus").fadeOut();
 //$("table").show();
  hacerLlamada()
})


var grtcClient = null;
var grtcSession = null;
var localID = "";
var remoteID = "";
var remoteStatusMsg = "";
var conf = null;
var remoteViewFactor = 1;
var newSessionOnNewOffer = false;



var configuration = { 
    "webrtc_gateway":"https://wrtc-arg.crossnet.la:8086",
    'turn_server': 'stun-arg.crossnet.la:3478?transport=tcp',
    'turn_username': 'genesys',
    'turn_password': 'genesys',
};

var grtcClient = new Grtc.Client(configuration);

function crearCliente(){
	grtcClient.setLogLevel(4);
	newSessionOnNewOffer = Grtc.getWebrtcDetectedBrowser() === "firefox";
	grtcClient.setRenewSessionOnNeed(false);
	grtcClient.setMediaConstraintsForOffer(true, true);
	grtcClient.setMediaConstraintsForAnswer(true, true);
  //console.log(document.getElementsByTagName("video"))




    var ancho = prompt("Indique su ancho de banda")
	grtcClient.setVideoBandwidth(1000);

	grtcClient.filterIceCandidates = function (Candidates) {
	    outCandidates = [];
	    var count = Candidates.length;
	    for (var i = 0; i < count; i++) {
	        var strCandidate = JSON.stringify(Candidates[i]);
	        // Ignore private addresses, which aren't necessary and seem to add delay.
	        // Also ignore tcp candidates that aren't used.
	        if (strCandidate.match(/ 192\.168\.\d{1,3}\.\d{1,3} \d+ typ host/i) === null &&
	            strCandidate.match(/ tcp \d+/i) === null) { 
	            outCandidates.push(Candidates[i]);
	        }
	    }
	    return outCandidates;
	};

	grtcSession = new Grtc.MediaSession(grtcClient);
	grtcSession.onRemoteStream.add(updateRemoteStatus);
	grtcSession.onRemoteStream.add(attachRemoteStream);
	grtcSession.onSessionHold.add( function(isTrue) {
	  if (isTrue) {
	    console.log("Call on-hold");
	    $("#remoteStatus").text(remoteStatusMsg + " - on-hold");
	  }
	});


	grtcClient.onIncomingCall.add(function(data){
	    grtcSession = new Grtc.MediaSession(grtcClient);
	    grtcSession.onRemoteStream.add(function (data2) { 
	        grtcClient.setViewFromStream(document.getElementById("remoteView"), data2.stream); 
          
	    })
	    remoteID = data.peer;
	    
	    var user_said = window.confirm("Desea recibir la llamada de " + data.peer + "?");
	    if (user_said === true){
	        $("#remoteStatus").empty();
	        $("#remoteStatus").append("call from " + remoteID); 
	        grtcSession.acceptCall(true, true, remoteID);
	    } 
	    else {
	        grtcSession.rejectCall(); grtcSession = null;
	    }
	    return false;
	});

	grtcClient.onCallEvent.add(function (data) {
        console.log("Call event: " + data.event);
        return false;
    });

    grtcClient.onNotifyEvent.add(function (data) {
        if (remoteID === "") {
            remoteID = data.peer;
            remoteStatusMsg = "Call from " + remoteID;
        }
        $("#remoteStatus").empty();
        if (data.event === "talk") {
            $("#remoteStatus").append(remoteStatusMsg + " - established");
        }
        else if (data.event === "hold") {
            $("#remoteStatus").append(remoteStatusMsg + " - on-hold");
        }
        return false;
    });
    
    // Invoked when info data arrives from the peer.
    grtcClient.onInfoFromPeer.add(function (data) {
        alert("Got data from peer:\n" + JSON.stringify(data));
        return false;
    });
    
    grtcClient.onIceDisconnected.add(function (obj) {
        if (grtcSession) // && grtcSession.isEstablished())
        {
            grtcSession.makeOffer();
        }
        return false;
    });

    grtcClient.onWebrtcError.add(function (obj) {
        alert("Got WebRTC error: " + JSON.stringify(obj));
        return false;
    });

    grtcClient.onConnectionError.add(function (obj) {
        if (grtcSession) // && grtcSession.isEstablished())
        {
            //alert("Got connection error: " + JSON.stringify(obj));
            //testDisconnect();
        }
        return false;
    });
    
    grtcClient.onGatewayError.add(function (obj) {
        //alert("Got gateway error: " + JSON.stringify(obj));
        //grtcSession.closeSession(true);
        return false;
    });
    
    // Invoked on WebRTC browser API error, which could be recoverable.
    // The app may want to ignore this error, log it, and/or inform the user.
    grtcClient.onWebrtcError.add(function (obj) {
        alert("Got WebRTC error: " + JSON.stringify(obj));
        return false;
    });
    
    // When the peer closes, this event is fired; do the necessary clean-up here.
    grtcClient.onPeerClosing.add(function () {
        if (grtcSession) {
            //grtcSession = null;
        }
        cleanupAfterCall();
        return false;
    });
    
    // Fired on no-answer timeout after making an initial or updated offer to peer.
    grtcClient.onPeerNoanswer.add(function () {
        if (grtcSession) {
            grtcSession.closeSession(true);
            //grtcSession = null;
        }
        cleanupAfterCall();
        return false;
    });

    grtcClient.onMediaSuccess.add(function (obj) {
		document.getElementById("localView").style.opacity = 1;
		grtcClient.setViewFromStream(document.getElementById("localView"), obj.stream);
    
		grtcSession.onRemoteStream.add(function (data2) { 
		    grtcClient.setViewFromStream(document.getElementById("remoteView"), data2.stream);
        
		})
		return false;	
    });


    grtcClient.onMediaFailure.add(function (obj) {
        alert(obj.message);
        return false;
    });
    
    function handleOnConnect(e) {
        $("#localStatus").empty();
        $("#localStatus").append("Registered anonymously");
        return false;
    }

    function handleOnRegister(e) {
        $("#localStatus").empty();
        $("#localStatus").append("Registered as " + localID);
        return false;
    }

    function handleOnConnectFailed(e) {
        alert(e.message);
        localID = "";
        return false;
    }
    
    grtcClient.onConnect.add(handleOnConnect);  
    grtcClient.onRegister.add(handleOnRegister);
    grtcClient.onFailed.add(handleOnConnectFailed);

    window.onbeforeunload = function() {
        grtcClient.disconnect();
    };
}

function habilitarMedios(){
	if (!grtcClient) { alert("Grtc.Client instance not created"); }
	else {
	    grtcClient.enableMediaSource(true, true);
	}
  
}

function register(){
  var registerID = parseInt(prompt("INGRESE DN USUARIO"));
  //var registerID = "6050";
  grtcClient.register(registerID);
  grtcSession = new Grtc.MediaSession(grtcClient);
  grtcSession.onRemoteStream.add(function (data2) { 
    grtcClient.setViewFromStream(document.getElementById("remoteView"), data2.stream); 
  })
}


function miData(elemento){
  return elemento.val()
}


function hacerLlamada(){
    var remoteID = prompt("Indique número de agente")
    $("#remoteStatus").empty();
    remoteStatusMsg = "Call to " + remoteID;
    $("#remoteStatus").append(remoteStatusMsg);


        /*****************EJEMPLO DE DATA1 A ADJUNTAR******************
        var JSON =   {
          "contra": "0441334", 
          "inte": "01",
          "idTurno": "1322",
          "domicilio": "Av. Corrientes 883"
        };


        var token = "IjFyYXNVQXlvVmV1IkVzdGFFc0xhTk9hdmVQdWJsaWNhUXVlVm95QVVzYXIxImJXQ51eUw3tdiEMamXDkKuFtz2xE/xO9kpuXA/TMDsqM0mJPl07J99ySpdhKD3DVAAYjQadkx/S3P3HknwT4kkuq8XqjavsLhZOnIvAwIju3SVqpuidCv83BgV4tPyreJKWf5MX0dWRxajwRPloo9jPg5MxGT8j29+HbkjRsoP8pfRLnAFLgrtYrvv+7PG73yyWkTf75wXtPgSWSpXUeqEuBfbCyTjebeCM1ba4TxlANtJrPbmBPLrzEQQjN7ldeHk7B5PGRnBpT/TGJmESKx2hhAgNC1lDjwbIQ5oXuCAHh1YjVbLroPZ0UQgDPuKXiW/NkpltKM0iru9JYwPa3X9pIz47wpS9twl/JeEXhIVVOLzDwcJkbEZX9IuOpADG7NTzV13l+ke0JZi5wVmm7FwfDscTpPR/LmzXxmttq7Qre7cV5OTJG2Ps6KXziWQx87a+wJzIiRoHxMvL7E5MtevBCliUuZuGh0M3l4I9nU8m1T9D0w4+VQkUIXBvDlHOtsNzTR5NCCFccbw4iIgMRpbwQDMs+MMHQhYXT+RMWYJdlmO4iWJC2vRcrdmHFkjo74wf1yXkP761SogZ+M1eSW23HYf+J5Q6Pkm9Du/3a9Q4Evur9DmzXhmQ6CWqx38+2Rq8vywgKWeUj6By+PIJ91rkIQRBRkpu3C6WOyvfgUvR3LosuOwT6FnCRHbEqmW9lITzbRZUktpwp6Prw0viXHjMn2gpF5MDuyGxQbnMj3uYwfIdiwACNwrgkvkpsyJJ8QVVkJ8Ciy82heWtLhWTdQ5Ktq2tkviFVpX/9fS+CWP4S0sNb+qUCn7YhjWzJdhiMPh0KzGVnVOkDwY8RKBS8UJ3Vt3nZHcaXpgsOlcYbtPSNpWTz5eYNgaVIu6zZuzx29UInLS25e1XrOeO4eFWsM/T4kWsdlQhVRdpRwliAOrDD4ABNlwbSULAhR7WkcfwtGdde+NCyeGH/USNoxXeWxA3acMl0ZbLfmUpkK0kZSKxNJeT/E/qzoFrfyCaiGAuIFwSChgFAyhgyXi904mJ39ZdjaU43ZGRopnJ7S1R4HotK+ThfAvR+drjZXKqIHjkdBs10C97jI1VedUAgr/+l3EJLnSMv9CTUj3UyZhyKFdmX+dDhtiCsLBiboJuzJGUPE8eikkUcQrvH//nth368xOjrcgr82iU8T9ADuz2h9O7p7/T+mIPglvCqBbZ8IETpbbJxdPFm/mwWmjmWFzn4CV7fbHHbplX0jQcxJ4d2iRIpgYj+pfWf+tAWal62EmHV1s8/FqAf75xm3rLo4SzJfODTR6k2QYoSSszfv+r9etrD/pIHFrHNR2kb9WyrFRReAk8yqTULxY/37yraMWVcaKF0un1aoK7EN31Zb/yL7rCjLEvj+3kNG8rOfRUsuRrUMnf1dMTPhFkit43T382DJcSpstz/CbK/E5nrz5qrtYeVI/mstX5AnGBe7dTU6ySxpp5aQBs9+lH8rHaEUUSDq8+uVAbcYaxZyndAIAx26w6XMlM2sSsVCKF3Kvd2z/B1kidnIGNk5p2BugnIFQLGn0HEjmS3Lqv5H1drXpRn44FhqYSI3YedX1LMnb5XQJm9EN2fGhg/53F4jzuS6YEEOtPA68Go8vEtCRZFL773A3HmmKTnB2RIDklkz7hojhzNm/9ZHioNkfj6HKbE6AvT2wRg9YYajXOxUCilmxKAsetEBwIlW1ZblihdbnuEdMsOnvv86+OzeIwApHBwgeHVfAfrWg11zBfcEw1c46tkHVezfN+T+uzUizAap9GxEM8RyMO/0sX/OcZiNNwKsfsqDI4gOaQuMWBSMuf2dv9FQwvSZl+eLsiXj11lwTWa1y3SA=="
        
         /*****************EJEMPLO DE DATA2 A ADJUNTAR********************
        var JSON = {
            "contra": "0709253",
            "inte": "01",
            "idTurno": "22791019",
            "domicilio": "Av. Corrientes 883"
        };
        var token = "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"
    
        /*EJEMPLO DE DATA 3 */
        var JSON = {"contra":"0441334","inte":"01","direccion":"NOBREGA 415, LOMAS DE ZAMORA, 1834"}
        var token = "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"
        

    /*************************FIN DEL EJEMPLO**********************/
        var dataToAttach = [
            {
                "key": "plain",
                "value": JSON,
            },
            {
                "key": "encrypted",
                "value": token,
            },
        ];
        grtcSession.setData(dataToAttach);
        $("#video_espera").fadeIn("slow", function(){
          document.getElementById("video_espera").play()
        });


    grtcSession.makeOffer(remoteID, true, true);
}

function check() {
  var isTrue = false;
    var rc = Grtc.isWebrtcSupported();
    if (rc) {
        // webrtc supported by browser
        isTrue = true;
       
    } else {
        // webrtc not supported by browser; warn the user
        isTrue = false
        alert("isWebrtcSupported: " + rc + ".\n" +
            "Este navegador no está habilitado para ejecutar esta función.\n");
    }
    return isTrue
};

function updateRemoteStatus(data) {
    // NOTE: when talk event is used, onNotifyEvent handler is used for this purpose.
    if (useTalkEvent === false) {
        $("#remoteStatus").empty();
        if (remoteID !== "") {      // A BYE could close session before we get here.
            $("#remoteStatus").append(remoteStatusMsg + " - established");
        }
    }
    return true;
}

function attachRemoteStream(data) {
    var element = document.getElementById("remoteView");
    if (element.getAttribute("src") === null) {
        console.log("Attaching remote stream");
    } else {
        console.log("Reattaching remote stream");
    }
    grtcClient.setViewFromStream(element, data.stream);
    return false;
}

function cleanupAfterCall() {
    savedStats = null;
    $("#remoteStatus").empty();
    remoteID = "";
    remoteStatusMsg = "";
}




