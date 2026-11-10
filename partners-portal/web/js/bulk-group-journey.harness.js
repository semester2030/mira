/**
 * E2A acceptance harness — NOT part of the publishable portal surface.
 * Loaded only by acceptance tests (init script / test runner).
 */
(function () {
  if (!window.__MIRA_E2A_HARNESS__) return;

  let boundState = null;
  let fileKeyFn = null;

  function hooks() {
    const state = boundState;
    if (!state) {
      return {
        getUploadState: function () {
          return null;
        },
        armClearPendingFileOnNextSave: function () {
          return { armed: false, reason: 'no-state' };
        },
        disarmClearPendingFileOnNextSave: function () {
          return { armed: false };
        },
      };
    }
    return {
      getUploadState: function () {
        return {
          cardId: state.cardId,
          uploadSessionId: state.uploadSessionId,
          uploadFileKey: state.uploadFileKey,
          mediaId: state.mediaId,
          priorMediaId: state.priorMediaId,
          hasFile: !!state.file,
          fileKey: fileKeyFn ? fileKeyFn(state.file) : null,
          uploadStatus: state.uploadStatus,
          replaceIntent: !!state.replaceIntent,
          previewGen: state.previewGen,
          busy: !!state.busy,
        };
      },
      armClearPendingFileOnNextSave: function () {
        state.__armClearPendingOnSave = true;
        return { armed: true };
      },
      disarmClearPendingFileOnNextSave: function () {
        state.__armClearPendingOnSave = false;
        return { armed: false };
      },
    };
  }

  window.__MIRA_BULK_JOURNEY_PLUGIN__ = {
    bind: function (api) {
      boundState = api.state;
      fileKeyFn = api.fileKey;
      if (window.MiraGroupJourney) window.MiraGroupJourney.__testHooks = hooks;
    },
    beforeEnsureVideoReady: function (state) {
      if (!state || !state.__armClearPendingOnSave) return;
      state.__armClearPendingOnSave = false;
      const card =
        state.batch && state.batch.cards
          ? state.batch.cards.find(function (c) {
              return c.cardId === state.cardId;
            })
          : null;
      const keepReplace =
        !!state.replaceIntent ||
        !!state.priorMediaId ||
        !!(card && card.media && card.media.videoMediaId);
      state.file = null;
      state.uploadFileKey = null;
      if (state.cardId) delete state.pendingByCard[state.cardId];
      state.replaceIntent = keepReplace;
    },
  };

  function attachHooksAlias() {
    if (!window.MiraGroupJourney) return false;
    window.MiraGroupJourney.__testHooks = hooks;
    return true;
  }

  // Journey module may assign MiraGroupJourney after this script; poll briefly.
  let n = 0;
  const iv = setInterval(function () {
    n += 1;
    if (attachHooksAlias() || n > 200) clearInterval(iv);
  }, 50);
})();
