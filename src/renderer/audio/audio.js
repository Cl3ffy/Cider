const CiderAudio = {
    context: null,
    source: null,
    audioNodes: {
        gainNode: null,
        audioBands: null,
        recorderNode: null,
    },
    ccON: false,
    mediaRecorder: null,
    init: function (cb = function () { }) {
        //AudioOutputs.fInit = true;
        let searchInt = setInterval(function () {
            if (document.getElementById("apple-music-player")) {
                //AudioOutputs.eqReady = true;
                document.getElementById("apple-music-player").crossOrigin = "anonymous";
                CiderAudio.connectContext(document.getElementById("apple-music-player"), 0);

                cb();
                clearInterval(searchInt);                
            }
        }, 1000);
    },
    off: function () {
        try {
            try {
                CiderAudio.audioNodes = {
                    gainNode: null,
                    audioBands: null,
                    recorderNode: null,
                }
            } catch (e) { }
            CiderAudio.source.connect(CiderAudio.context.destination);
        } catch (e) { }
    },
    connectContext: function (mediaElem) {
        if (!CiderAudio.context) {
            CiderAudio.context = new window.AudioContext({ sampleRate: 96000, latencyHint: "playback"}); // Don't ever remove the sample rate arg. Ask Maikiwi.
            app.lyricOffset = CiderAudio.context.baseLatency + (CiderAudio.context.outputLatency ? CiderAudio.context.outputLatency : 0)
        }
        if (!CiderAudio.source) {
            CiderAudio.source = CiderAudio.context.createMediaElementSource(mediaElem);
        } else { try { CiderAudio.source.disconnect(CiderAudio.context.destination) } catch (e) { } }
        CiderAudio.audioNodes.gainNode = CiderAudio.context.createGain()
        CiderAudio.source.connect(CiderAudio.audioNodes.gainNode);
        if (app.cfg.audio.normalization) {
            CiderAudio.normalizerOn()
        }
        CiderAudio.hierarchical_loading();
    },
    normalizerOn: function () {
        try {
            let previewURL = null
            try {
                previewURL = app.mk.nowPlayingItem.previewURL
            } catch (e) {
            }
            if (previewURL == null && ((app.mk.nowPlayingItem?._songId ?? (app.mk.nowPlayingItem["songId"] ?? app.mk.nowPlayingItem.relationships.catalog.data[0].id)) != -1)) {
                app.mk.api.v3.music(`/v1/catalog/${app.mk.storefrontId}/songs/${app.mk.nowPlayingItem?._songId ?? (app.mk.nowPlayingItem["songId"] ?? app.mk.nowPlayingItem.relationships.catalog.data[0].id)}`).then((response) => {
                    previewURL = response.data.data[0].attributes.previews[0].url
                    if (previewURL)
                        ipcRenderer.send('getPreviewURL', previewURL)
                })
            } else {
                if (previewURL)
                    ipcRenderer.send('getPreviewURL', previewURL)
            }

        } catch (e) {
            console.debug("[Cider][MaikiwiSoundCheck] normalizer func err: " + e)
        }
    },
    normalizerOff: function () {
        CiderAudio.audioNodes.gainNode.gain.exponentialRampToValueAtTime(1.0, CiderAudio.context.currentTime + 0.5);
    },
    sendAudio: function () {
        if (!CiderAudio.ccON) {
            CiderAudio.ccON = true
            let searchInt = setInterval(async function () {
                if (CiderAudio.context != null && CiderAudio.audioNodes.gainNode != null) {
                    // var options = {
                    //     mimeType: 'audio/webm; codecs=opus'
                    // };
                    // var destnode = CiderAudio.context.createMediaStreamDestination();
                    // CiderAudio.audioNodes.intelliGainComp.connect(CiderAudio.audioNodes.gainNode);
                    //            CiderAudio.audioNodes.gainNode.connect(destnode)
                    // CiderAudio.mediaRecorder = new MediaRecorder(destnode.stream, options);
                    // CiderAudio.mediaRecorder.start(1);
                    // CiderAudio.mediaRecorder.ondataavailable = function (e) {
                    //     e.data.arrayBuffer().then(buffer => {
                    //         ipcRenderer.send('writeAudio', buffer)
                    //     }
                    //     );
                    // }
                    const worklet = `class RecorderWorkletProcessor extends AudioWorkletProcessor {
                        static get parameterDescriptors() {
                          return [{
                            name: 'isRecording',
                            defaultValue: 0
                          },
                          {
                            name: 'numberOfChannels',
                            defaultValue: 2
                          }
                        ];
                        }
                      
                        constructor() {
                          super();
                          this._bufferSize = 1024;
                          this._buffers = null;
                          this._initBuffer();
                        }
                        _initBuffers(numberOfChannels) {
                          this._buffers = [];
                          for (let channel=0; channel < numberOfChannels; channel++) {
                            this._buffers.push(new Float32Array(this._bufferSize));
                          }
                        }
                      
                        _initBuffer() {
                          this._bytesWritten = 0;
                        }
                      
                        _isBufferEmpty() {
                          return this._bytesWritten === 0;
                        }
                      
                        _isBufferFull() {
                          return this._bytesWritten === this._bufferSize;
                        }
                        _pushToBuffers(audioRawData, numberOfChannels) {
                          if (this._isBufferFull()) {
                              this._flush();
                          }
                          let dataLength = audioRawData[0]?.length ?? 0;
                          for (let idx=0; idx<dataLength; idx++) {
                            for (let channel=0; channel < numberOfChannels; channel++) {
                              let value = audioRawData[channel][idx];
                              this._buffers[channel][this._bytesWritten] = value;
                            }
                            this._bytesWritten += 1;
                          }
                        }
                      
                        _flush() {
                          let buffers = [];
                          this._buffers.forEach((buffer, channel) => {
                            if (this._bytesWritten < this._bufferSize) {
                              buffer = buffer.slice(0, this._bytesWritten);
                            }
                            buffers[channel] = buffer;
                          });
                          this.port.postMessage({
                            eventType: 'data',
                            audioBuffer: buffers,
                            bufferSize: this._bufferSize
                          });
                          this._initBuffer();
                        }
                      
                        _recordingStopped() {
                          this.port.postMessage({
                            eventType: 'stop'
                          });
                        }
                      
                        process(inputs, outputs, parameters) {
                          const isRecordingValues = parameters.isRecording;
                          const numberOfChannels = parameters.numberOfChannels[0];   
                          if (this._buffers === null) {
                            this._initBuffers(numberOfChannels);
                          }
                          
                          for (let dataIndex = 0; dataIndex < isRecordingValues.length; dataIndex++) 
                          {
                            const shouldRecord = isRecordingValues[dataIndex] === 1;
                            if (!shouldRecord && !this._isBufferEmpty()) {
                              this._flush();
                              this._recordingStopped();
                            }
                      
                            if (shouldRecord) {
                              let audioRawData = inputs[0];
                              this._pushToBuffers(audioRawData, numberOfChannels);
                            }
                          }
                          return true;
                        }
                      
                      }
                      
                      registerProcessor('recorder-worklet', RecorderWorkletProcessor);`
                    let blob = new Blob([worklet], { type: 'application/javascript' });
                    await CiderAudio.context.audioWorklet.addModule(URL.createObjectURL(blob))
                        .then(() => {

                            const channels = 2;
                            CiderAudio.audioNodes.recorderNode = new window.AudioWorkletNode(CiderAudio.context,
                                'recorder-worklet',
                                { parameterData: { numberOfChannels: channels } });
                            CiderAudio.audioNodes.recorderNode.port.onmessage = (e) => {
                                const data = e.data;
                                switch (data.eventType) {
                                    case "data":
                                        const audioData = data.audioBuffer;
                                        const bufferSize = data.bufferSize;
                                        if ((audioData[0]).some(item => item !== 0) || (audioData[0]).some(item => item !== 0)) {
                                            ipcRenderer.send('writeWAV', audioData[0], audioData[1], bufferSize);
                                        }
                                        break;
                                    case "stop":
                                        break;
                                }
                            }
                            CiderAudio.audioNodes.recorderNode.parameters.get('isRecording').setValueAtTime(1, CiderAudio.context.currentTime);
                            CiderAudio.audioNodes.intelliGainComp.connect(CiderAudio.audioNodes.recorderNode);

                        });
                    clearInterval(searchInt);
                }
            }, 1000);
        } else {
            if (CiderAudio.audioNodes.recorderNode != null && CiderAudio.context != null) {
                CiderAudio.audioNodes.recorderNode.parameters.get('isRecording').setValueAtTime(1, CiderAudio.context.currentTime);
                // CiderAudio.audioNodes.recorderNode = null;
                // CiderAudio.ccON = false;
            }
        }

    },
    stopAudio() {
        if (CiderAudio.audioNodes.recorderNode != null && CiderAudio.context != null) {
            CiderAudio.audioNodes.recorderNode.parameters.get('isRecording').setValueAtTime(0, CiderAudio.context.currentTime);
            // CiderAudio.audioNodes.recorderNode = null;
            // CiderAudio.ccON = false;
        }
    },
    hierarchical_unloading: function () {
        try { CiderAudio.audioNodes.gainNode.disconnect(); } catch (e) { }
        try { for (var i of CiderAudio.audioNodes.audioBands) { i.disconnect(); } CiderAudio.audioNodes.audioBands = null} catch (e) { };
        console.debug("[Cider][Audio] Finished hierarchical unloading")
    },
    hierarchical_loading: async function () {
        const configMap = new Map([
            ['n3', Math.max(...app.cfg.audio.equalizer.gain) != 0]
        ]);

        CiderAudio.hierarchical_unloading();
        let lastNode = 'n0';
        for (let [tier, value] of configMap.entries()) { 
            if (value === true) {
                switch (tier) {
                    case 'n3':
                        CiderAudio.equalizer(true, lastNode);
                        lastNode = 'n3';
                        break;      
                }
            }
        }

        switch (lastNode) {
            case 'n3':
                CiderAudio.audioNodes.gainNode.connect(CiderAudio.audioNodes.audioBands[0]);
                console.debug("[Cider][Audio] gainNode -> audioBands");   
                break;
            case 'n0': 
                CiderAudio.audioNodes.gainNode.connect(CiderAudio.context.destination);
                console.debug("[Cider][Audio] gainNode -> destination");
                break;
        }

        console.debug('[Cider][Audio]\n' + [...configMap.entries()] + '\n lastNode: ' + lastNode);

        CiderAudio.intelliGainComp_n0_0();
        console.debug("[Cider][Audio] Finished hierarchical loading");

    },

    equalizer: function (status, destination) { // n3_1
        if (status === true) {
            let BANDS = app.cfg.audio.equalizer.frequencies;
            let GAIN = app.cfg.audio.equalizer.gain;
            let Q = app.cfg.audio.equalizer.Q;

            CiderAudio.audioNodes.audioBands = [];
            for (let i = 0; i < BANDS.length; i++) {
                CiderAudio.audioNodes.audioBands[i] = CiderAudio.context.createBiquadFilter();
                CiderAudio.audioNodes.audioBands[i].type = 'peaking'; // 'peaking';
                CiderAudio.audioNodes.audioBands[i].frequency.value = BANDS[i];
                CiderAudio.audioNodes.audioBands[i].Q.value = Q[i];
                CiderAudio.audioNodes.audioBands[i].gain.value = GAIN[i] * app.cfg.audio.equalizer.mix;
            }

            for (let i = 1; i < BANDS.length; i++) {
                CiderAudio.audioNodes.audioBands[i - 1].connect(CiderAudio.audioNodes.audioBands[i]);
            }

            switch (destination) {
                case 'n0':
                    try { CiderAudio.audioNodes.audioBands.at(-1).connect(CiderAudio.context.destination); console.debug("[Cider][Audio] Equalizer -> destination");} catch (e) { }
                    break;        
            }

        }
    }
}
export { CiderAudio }