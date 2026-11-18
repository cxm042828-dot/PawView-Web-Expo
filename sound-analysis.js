// 本机声音分类：不保存录音，不上传麦克风音频
(() => {
  const status = document.getElementById("soundAnalysisStatus");
  const result = document.getElementById("soundAnalysisResult");

  if (!status || !result) return;

  let generation = 0;
  let session = null;
  let labelsPromise = null;
  const dogStateElement = document.getElementById("dogSoundState");

  // 测试初始值，后续需要根据真实样本调整
  const DOG_SCORE_THRESHOLD = 0.15;


  // 只检查最近 15 秒内实际分析完成的最多 8 段声音
  const WINDOW_MS = 15000;
  const WINDOW_SIZE = 8;
  const REQUIRED_HITS = 4;

  let dogHistory = [];
    // 记录重复声音状态，避免每次分析都重复发送通知事件
let repeatedSoundActive = false;

function publishSound(repeated, message = "") {
  // 保留原有声音识别事件
  document.dispatchEvent(
    new CustomEvent("pawview:dog-sound", {
      detail: {
        repeated,
        message
      }
    })
  );

  // 仅在首次进入重复声音状态时发送通知事件
  if (repeated && !repeatedSoundActive) {
    document.dispatchEvent(
      new CustomEvent("pawview:repeated-sound-detected", {
        detail: {
          message,
          time: new Date().toISOString()
        }
      })
    );
  }

  repeatedSoundActive = repeated;
}

   function resetDogAnalysis() {
    dogHistory = [];
    publishSound(false);

    if (dogStateElement) {
      dogStateElement.textContent =
        "마이크를 켜면 반복되는 소리인지 확인해요.";
    }
  }


  function updateDogAnalysis(values, labels) {
    function scoreOf(name) {
      const index = labels.indexOf(name);
      return index >= 0 ? values[index] : 0;
    }


    // 不相加，避免同一声音的重叠类别重复累加
    const barkScore = Math.max(
      scoreOf("Bark"),
      scoreOf("Bow-wow"),
      scoreOf("Yip")
    );

    const whimperScore = scoreOf("Whimper (dog)");
    const howlScore = scoreOf("Howl");
    const growlScore = scoreOf("Growling");

    const now = performance.now();

    dogHistory = dogHistory
      .filter(item => now - item.time <= WINDOW_MS);

       dogHistory.push({
      time: now,
      bark: barkScore >= DOG_SCORE_THRESHOLD,
      whimper: whimperScore >= DOG_SCORE_THRESHOLD,
            howl: howlScore >= DOG_SCORE_THRESHOLD,
      growl: growlScore >= DOG_SCORE_THRESHOLD
    });


    dogHistory = dogHistory.slice(-WINDOW_SIZE);

        const countHits = key =>
      dogHistory.filter(item => item[key]).length;

    const barkHits = countHits("bark");
    const whimperHits = countHits("whimper");
    const howlHits = countHits("howl");
    const growlHits = countHits("growl");


    if (!dogStateElement) return;

    if (dogHistory.length < WINDOW_SIZE) {
            publishSound(false);

            dogStateElement.textContent =
        "반복해서 나는 소리인지 잠시 확인하고 있어요.";
      return;
    }

    const detectedTypes = [];

    if (barkHits >= REQUIRED_HITS) {
      detectedTypes.push("짖는 소리가 반복해서 들리는 것 같아요.");
    }

    if (whimperHits >= REQUIRED_HITS) {
      detectedTypes.push("낑낑거리는 소리가 반복해서 들리는 것 같아요.");
    }

    if (howlHits >= REQUIRED_HITS) {
      detectedTypes.push("길게 울부짖는 소리가 반복해서 들리는 것 같아요.");
    }
    if (growlHits >= REQUIRED_HITS) {
      detectedTypes.push(
        "으르렁거리는 소리가 반복해서 들리는 것 같아요."
      );
    }

        if (detectedTypes.length > 0) {
      const message = detectedTypes.join(" ");

      dogStateElement.textContent =
        message +
        " 강아지가 무엇을 하고 있는지 확인해 주세요.";

      publishSound(true, message);
    } else {
      dogStateElement.textContent =
        "지금까지는 반복되는 강아지 울음소리가 뚜렷하게 확인되지 않았어요.";

      publishSound(false);
    }
  }

  const koreanNames = {
    "Dog": "강아지",
    "Bark": "짖는 소리",
    "Yip": "짧고 높은 강아지 소리",
    "Howl": "하울링",
    "Bow-wow": "멍멍 소리",
    "Growling": "으르렁거리는 소리",
    "Whimper (dog)": "강아지 낑낑거리는 소리",
    "Speech": "사람 말소리",
    "Music": "음악",
    "Silence": "무음",
    "Cat": "고양이",
    "Meow": "고양이 울음소리"
  };

  function loadLabels() {
    if (!labelsPromise) {
      labelsPromise = (async () => {
        const response = await fetch(
          "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv"
        );

        if (!response.ok) {
          throw new Error("Class labels download failed");
        }

        const text = await response.text();
        const labels = [];

        for (const line of text.trim().split(/\r?\n/).slice(1)) {
          const match = line.match(/^(\d+),[^,]+,(.*)$/);
          if (!match) continue;

          let name = match[2].trim();

          if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).replace(/""/g, '"');
          }

          labels[Number(match[1])] = name;
        }

        if (
          labels.length !== 521 ||
          Array.from({ length: 521 }, (_, i) => labels[i])
            .some(name => !name)
        ) {
          throw new Error("Invalid class labels");
        }

        return labels;
      })().catch(error => {
        labelsPromise = null;
        throw error;
      });
    }

    return labelsPromise;
  }

  function stopAnalysis(message = "소리 분석 중지됨") {
    resetDogAnalysis();

    generation += 1;

    const previous = session;
    session = null;

    if (previous) {
      if (previous.node) {
        previous.node.port.onmessage = null;
        previous.node.disconnect();
      }

      previous.source?.disconnect();

      previous.context.close().catch(error => {
        console.warn("오디오 분석 종료:", error);
      });
    }

    status.textContent = message;
    result.textContent = "현재 분석 결과가 없습니다.";
  }

  async function analyseSamples(samples, currentSession, labels, model) {
    if (
      session !== currentSession ||
      currentSession.busy ||
      document.hidden
    ) {
      return;
    }

    currentSession.busy = true;

    let input = null;
    let outputs = null;
    let meanScores = null;

    try {
      input = window.tf.tensor1d(samples);

      outputs = await model.executeAsync(input);

      const tensors = Array.isArray(outputs)
        ? outputs
        : outputs instanceof window.tf.Tensor
          ? [outputs]
          : Object.values(outputs);

      const scores = tensors.find(tensor =>
        tensor.rank === 2 &&
        tensor.shape[1] === labels.length
      );

      if (!scores) {
        throw new Error("Model scores output not found");
      }

      meanScores = scores.mean(0);
      const values = await meanScores.data();

      if (session !== currentSession || document.hidden) return;

        updateDogAnalysis(values, labels);

      const topResults = Array.from(values, (score, index) => ({
        index,
        score
      }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

           const topName = labels[topResults[0].index];

      const simpleNames = {
        "Dog": "강아지 소리로 들려요.",
        "Bark": "강아지가 짖는 소리로 들려요.",
        "Bow-wow": "강아지가 짖는 소리로 들려요.",
        "Yip": "강아지가 짧게 짖는 소리로 들려요.",
        "Whimper (dog)": "강아지가 낑낑거리는 소리로 들려요.",
        "Howl": "길게 울부짖는 소리로 들려요.",
        "Growling": "으르렁거리는 소리로 들려요.",
        "Animal": "동물 소리로 들려요. 어떤 소리인지는 더 확인해야 해요.",
        "Domestic animals, pets":
          "반려동물 소리로 들려요. 강아지 소리인지는 더 확인해야 해요.",
        "Speech": "사람이 말하는 소리로 들려요.",
        "Music": "음악 소리로 들려요.",
        "Silence": "지금은 뚜렷한 소리가 들리지 않아요."
      };

      result.textContent = simpleNames[topName] ||
        "주변 소리가 들려요. 어떤 소리인지는 아직 구분하기 어려워요.";

      const time = new Date().toLocaleTimeString("ko-KR");

          status.textContent =
        `주변 소리를 듣고 있어요 · ${time} 업데이트`;

    } catch (error) {
      console.error("실시간 소리 분석 실패:", error);

      if (session === currentSession) {
        stopAnalysis(
          "소리 분석에 실패했습니다. 마이크를 끈 뒤 다시 시도해 주세요."
        );
      }
    } finally {
      if (outputs) window.tf.dispose(outputs);
      meanScores?.dispose();
      input?.dispose();

      currentSession.busy = false;
    }
  }

   document.addEventListener("pawview:mic-start", async event => {
    stopAnalysis();

    const stream = event.detail?.stream;
    if (!stream) return;

    // 必须在等待模型前记录本次请求编号
    const thisGeneration = generation;

    status.textContent =
      "소리 분석을 준비하고 있어요. 준비가 끝나면 자동으로 시작해요.";

    try {
      const loader = window.pawviewSoundModel;

      if (!loader?.ready) {
        throw new Error("Sound model loader unavailable");
      }

      // 模型还没准备好时等待，不要求用户重开麦克风
      const model = await loader.ready();

      // 等待时若关闭麦克风或进入后台，不再接上旧请求
      if (
        thisGeneration !== generation ||
        document.hidden ||
        !stream.getAudioTracks().some(track =>
          track.readyState === "live"
        )
      ) {
        return;
      }

      if (!model) {
        stopAnalysis(
          "소리 분석을 준비하지 못했어요. 인터넷 연결을 확인한 뒤 마이크를 껐다가 다시 켜 주세요."
        );
        return;
      }

      const labels = await loadLabels();


      if (
        thisGeneration !== generation ||
        document.hidden ||
        !stream.getAudioTracks().some(track =>
          track.readyState === "live"
        )
      ) {
        return;
      }

      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("AudioContext not supported");
      }

      const context = new AudioContextClass({
        sampleRate: 16000
      });

      const currentSession = {
        context,
        source: null,
        node: null,
        busy: false
      };

      session = currentSession;

      if (context.sampleRate !== 16000) {
        throw new Error("16000 Hz audio not supported");
      }

      await context.audioWorklet.addModule(
        "./sound-capture-worklet.js"
      );

      if (session !== currentSession) return;

      const source = context.createMediaStreamSource(stream);

      const node = new AudioWorkletNode(
        context,
        "pawview-sound-capture"
      );

      currentSession.source = source;
      currentSession.node = node;

      node.port.onmessage = message => {
        analyseSamples(
          message.data,
          currentSession,
          labels,
          model
        );
      };

      source.connect(node);

      // Worklet 不复制输入到输出，因此不会播放麦克风声音
      node.connect(context.destination);

      await context.resume();

      if (session !== currentSession) return;

      status.textContent = context.state === "running"
        ? "분석 중 · 첫 결과를 기다리고 있습니다."
        : "오디오가 일시 정지되었습니다. 마이크를 껐다가 다시 켜 주세요.";

      context.addEventListener("statechange", () => {
        if (
          session === currentSession &&
          context.state !== "running"
        ) {
          status.textContent =
            "오디오 분석이 일시 정지되었습니다. 다시 연결해 주세요.";
        }
      });
    } catch (error) {
      console.error("소리 분석 준비 실패:", error);

      if (thisGeneration === generation) {
        stopAnalysis(
          "분석 준비에 실패했습니다. 콘솔 오류를 확인해 주세요."
        );
      }
    }
  });

  document.addEventListener("pawview:mic-stop", () => {
    stopAnalysis();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAnalysis();
  });

  window.addEventListener("pagehide", () => {
    stopAnalysis();
  });
})();
