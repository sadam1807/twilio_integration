var activeRoom;
var previewTracks;
var identity;
var roomName;
var activeScreenTrack;

function attachTrack(track, container) {
  container.appendChild(track.attach());
}

// Attach array of Tracks to the DOM.
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    attachTrack(track, container);
  });
}

// Detach given track from the DOM.
function detachTrack(track) {
  track.detach().forEach(function(element) {
    element.remove();
  });
}

// Appends remoteParticipant name to the DOM.
function appendName(identity, container) {
  const name = document.createElement('p');
  name.id = `participantName-${identity}`;
  name.className = 'instructions';
  name.textContent = identity;
  container.appendChild(name);
}

// Removes remoteParticipant container from the DOM.
function removeName(participant) {
  if (participant) {
    let { identity } = participant;
    const container = document.getElementById(
      `participantContainer-${identity}`
    );
    container.parentNode.removeChild(container);
  }
}

// A new RemoteTrack was published to the Room.
function trackPublished(publication, container) {
  if (publication.isSubscribed) {
    attachTrack(publication.track, container);
  }
  publication.on('subscribed', function(track) {
    log('Subscribed to ' + publication.kind + ' track');
    attachTrack(track, container);
  });
  publication.on('unsubscribed', detachTrack);
}

// A RemoteTrack was unpublished from the Room.
function trackUnpublished(publication) {
  log(publication.kind + ' track was unpublished.');
}

// A new RemoteParticipant joined the Room
function participantConnected(participant, container) {
  let selfContainer = document.createElement('div');
  selfContainer.id = `participantContainer-${participant.identity}`;

  container.appendChild(selfContainer);
  appendName(participant.identity, selfContainer);

  participant.tracks.forEach(function(publication) {
    trackPublished(publication, selfContainer);
  });
  participant.on('trackPublished', function(publication) {
    trackPublished(publication, selfContainer);
  });
  participant.on('trackUnpublished', trackUnpublished);
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = getTracks(participant);
  tracks.forEach(detachTrack);
}

// Check for WebRTC
if (!navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
  alert('WebRTC is not available in your browser.');
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener('beforeunload', leaveRoomIfJoined);

$.getJSON('/token.php', function(data) {
  identity = data.identity;

  document.getElementById('room-controls').style.display = 'block';

  // Bind button to join room
  document.getElementById('button-join').onclick = function () {
    roomName = document.getElementById('room-name').value;
    if (roomName) {
      log("Joining room '" + roomName + "'...");

      var connectOptions = { name: roomName, logLevel: 'debug' };
      if (previewTracks) {
        connectOptions.tracks = previewTracks;
      }

      Twilio.Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
        log('Could not connect to Twilio: ' + error.message);
      });
    } else {
      alert('Please enter a room name.');
    }
  };

  // Bind button to leave room
  document.getElementById('button-leave').onclick = function () {
    log('Leaving room...');
    activeRoom.disconnect();
  };

  document.getElementById('button-share').onclick = function () {
       shareScreen();
  };
  
  // document.getElementById('button-stop').onclick = function () { 
  //   stopScreen();
  // }

  document.getElementById('button-mute-audio').onclick = function () { 
    muteUnmuteAudio();
  }

  document.getElementById('button-mute-video').onclick = function () { 
    muteUnmuteVideo();
  }

});

function getTracks(participant) {
  return Array.from(participant.tracks.values()).filter(function(publication) {
      return publication.track;
    }).map(function(publication) {
      return publication.track;
    });
}

// Successfully connected!

function roomJoined(room) {
  window.room = activeRoom = room;
  log("Joined as '" + identity + "'");
  document.getElementById('button-join').style.display = 'none';
  document.getElementById('button-leave').style.display = 'inline';
  document.getElementById('button-share').style.display = 'inline';
  document.getElementById('button-mute-audio').style.display = 'inline';
  document.getElementById('button-mute-video').style.display = 'inline';

  var previewContainer = document.getElementById('local-media');
  if (!previewContainer.querySelector('video')) {
    attachTracks(getTracks(room.localParticipant), previewContainer);
  }

  // Attach the Tracks of the Room's Participants.
  var remoteMediaContainer = document.getElementById('remote-media');
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    participantConnected(participant, remoteMediaContainer);
  });

  // When a Participant joins the Room, log the event.
  room.on('participantConnected', function(participant) {
    log("Joining: '" + participant.identity + "'");
    participantConnected(participant, remoteMediaContainer);
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on('participantDisconnected', function(participant) {
    log("RemoteParticipant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
    removeName(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on('disconnected', function() {
    log('Left');
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
      previewTracks = null;
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    room.participants.forEach(removeName);
    activeRoom = null;
    document.getElementById('button-join').style.display = 'block';
    document.getElementById('button-leave').style.display = 'none';
  });
}

function muteUnmuteAudio(){
  //var localParticipant = activeRoom.localParticipant;
   activeRoom.localParticipant.audioTracks.forEach(function(track)  {
    if ( track.track.isEnabled == true ) {
      document.getElementById("button-mute-audio").innerHTML="Unmute Audio";
      track.track.disable();
    } else {
      document.getElementById("button-mute-audio").innerHTML="Mute Audio";
      track.track.enable();
    }
    });
}


function muteUnmuteVideo(){
  activeRoom.localParticipant.videoTracks.forEach(function(track)  {
    if ( track.track.isEnabled == true ) {
      document.getElementById("button-mute-video").innerHTML="Unmute Video";
      track.track.disable();
    } else {
      document.getElementById("button-mute-video").innerHTML="Mute Video";
      track.track.enable();
    }
    });

}


async function shareScreen(){
  const stream = await navigator.mediaDevices.getDisplayMedia()
  const screenTrack = new Twilio.Video.LocalVideoTrack(stream.getTracks()[0]);
  activeScreenTrack = screenTrack
  activeRoom.localParticipant.publishTrack(screenTrack);
  document.getElementById("button-share").innerHTML="Stop Sharing";
  screenTrack.once('stopped', () => {
    activeRoom.localParticipant.removeTrack(screenTrack);
    document.getElementById("button-share").innerHTML="Share Screen";
  });
}

function stopScreen(){
    activeRoom.localParticipant.removeTrack(activeScreenTrack);
    document.getElementById("button-share").innerHTML="Share Screen";
}
//  Local video preview
document.getElementById('button-preview').onclick = function() {

  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Twilio.Video.createLocalTracks();

  localTracksPromise.then(function(tracks) {
    previewTracks = tracks;
    var previewContainer = document.getElementById('local-media');
    if (!previewContainer.querySelector('video')) {
      attachTracks(tracks, previewContainer);
    }
  }, function(error) {
    console.error('Unable to access local media', error);
    log('Unable to access Camera and Microphone');
  });
};

// Activity log
function log(message) {
  var logDiv = document.getElementById('log');
  logDiv.innerHTML += '<p>&gt;&nbsp;' + message + '</p>';
  logDiv.scrollTop = logDiv.scrollHeight;
}

function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}
