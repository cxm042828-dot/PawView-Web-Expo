// 自动准备声音模型；不自动打开麦克风
(() => {
  const button = document.getElementById("loadSoundModelButton");
  const status = document.getElementById("soundModelStatus");

  let model = null;
  let loadingPromise = null;

  function showStatus(message) {
    if (status) status.textContent = message;
  }

  function loadModel() {
    if (model) return Promise.resolve(model);
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      if (!window.tf) {
        throw new Error("TensorFlow script unavailable");
      }

      if (button) button.disabled = true;

      showStatus("소리 분석을 준비하고 있어요.");

      await window.tf.ready();

      model = await window.tf.loadGraphModel(
        "https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1",
        { fromTFHub: true }
      );

      showStatus("소리 분석 준비 완료");

      return model;
    })()
      .catch(error => {
        console.error("声音模型准备失败：", error);

        showStatus(
          "소리 분석을 준비하지 못했어요. 인터넷 연결을 확인해 주세요."
        );

        // 返回 null，由声音分析界面显示失败提示
        return null;
      })
      .finally(() => {
        loadingPromise = null;

        if (button) {
          button.disabled = model !== null;
        }
      });

    return loadingPromise;
  }

  window.pawviewSoundModel = {
    getModel: () => model,
    ready: loadModel
  };

  // 保留旧按钮兼容，但界面中已隐藏
  button?.addEventListener("click", () => {
    void loadModel();
  });

  // 网络恢复后允许重新准备，避免无限自动重试
  window.addEventListener("online", () => {
    if (!model) void loadModel();
  });

  // 打开页面后自动准备，不采集声音
  void loadModel();
})();
