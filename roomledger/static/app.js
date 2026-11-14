/* RoomLedger browser workbench. No persistence, remote assets, or build dependencies. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const DEPRECIATION = {
    electronics: 0.20, furniture: 0.10, appliance: 0.14,
    kitchenware: 0.12, decor: 0.10, clothing: 0.25,
    sports: 0.16, musical: 0.08, other: 0.15,
  };
  const CONDITION_FACTOR = { new: 1, good: 0.85, fair: 0.65, poor: 0.35 };
  const FIXES = {
    tension_poles: { en: "Tension poles", ja: "突っ張り棒", unit: 2400 },
    l_brackets: { en: "L-brackets", ja: "L字金具", unit: 1200 },
    tv_straps: { en: "TV anti-tip straps", ja: "テレビ転倒防止ベルト", unit: 1800 },
    gel_mats: { en: "Anti-slip gel mats", ja: "耐震ジェルマット", unit: 900 },
    glass_film: { en: "Shatter-protection glass film", ja: "飛散防止フィルム", unit: 1600 },
    fridge_belts: { en: "Refrigerator belts", ja: "冷蔵庫転倒防止ベルト", unit: 2200 },
  };
  const UI_TEXT = {
    exportCsv: { en: "Export CSV", ja: "CSV出力" },
    printReport: { en: "Print report", ja: "レポート印刷" },
    themeDark: { en: "Dark mode", ja: "ダークモード" },
    themeLight: { en: "Light mode", ja: "ライトモード" },
    heroTitleA: { en: "Know what you own.", ja: "持ち物を、記録する。" },
    heroTitleB: { en: "Secure what matters.", ja: "大切なものを、守る。" },
    heroSummary: { en: "Turn room photos into an evidence-backed home ledger for insurance recovery and a practical plan for the next earthquake.", ja: "部屋の写真から、保険請求に使える家財の証拠リストと、地震に備える実践的な対策を作成します。" },
    startRooms: { en: "Start with your rooms", ja: "部屋の写真から始める" },
    fileRules: { en: "JPEG, PNG or WebP · up to 8 photos · 12 MB each", ja: "JPEG、PNG、WebP · 写真は8枚まで · 各12MB" },
    dropTitle: { en: "Drop room photos here", ja: "ここに部屋の写真をドロップ" },
    or: { en: "or", ja: "または" },
    chooseDevice: { en: "choose from your device", ja: "デバイスから選択" },
    clearSelection: { en: "Clear selection", ja: "選択をクリア" },
    analyzeRooms: { en: "Analyze selected rooms", ja: "選択した部屋を分析" },
    noPhotos: { en: "No photos handy?", ja: "写真がない場合は？" },
    sampleHome: { en: "Try with sample home", ja: "サンプルホームを試す" },
    sampleDetails: { en: "6 rooms · cached offline demo", ja: "6部屋 · キャッシュ済みオフライン" },
    replacementTotal: { en: "Replacement total", ja: "再調達価額の合計" },
    actualCashValue: { en: "Actual cash value", ja: "実際現金価額（ACV）" },
    currentEdited: { en: "Current edited inventory", ja: "編集後の現在の家財台帳" },
    ageAdjusted: { en: "Age & condition adjusted", ja: "年数・状態を考慮" },
    itemsLabel: { en: "Items", ja: "項目数" },
    acrossRooms: { en: "Across all included rooms", ja: "対象の全部屋" },
    roomsLabel: { en: "Rooms", ja: "部屋数" },
    usableEvidence: { en: "With usable evidence", ja: "有効な証拠写真あり" },
    insurance: { en: "Insurance", ja: "保険" },
    quakeReady: { en: "Quake-Ready", ja: "地震対策" },
    inspectEvidence: { en: "Inspect the evidence", ja: "証拠を確認" },
    inspectHint: { en: "Choose a numbered box or item. You can verify the crop, correct details, and keep totals current.", ja: "番号の枠または項目を選択。切り抜き画像の確認や修正、合計の更新ができます。" },
    plainLanguage: { en: "Plain language", ja: "わかりやすい表示" },
    technical: { en: "Technical", ja: "技術ログ" },
    yourEvidenceLedger: { en: "Your evidence ledger", ja: "家財の証拠台帳" },
    skipInventory: { en: "Skip to inventory", ja: "家財台帳へ移動" },
    heroMarker: { en: "Disaster inventory, made tangible", ja: "災害時の家財を、目に見える記録に" },
    mappedTitle: { en: "Every visible item, mapped.", ja: "写っている品目をすべて記録。" },
    mappedBody: { en: "Numbered boxes, evidence crops, replacement cost and actual cash value.", ja: "番号付きの枠、証拠画像、再調達価額、実際現金価額を確認できます。" },
    hazardsTitle: { en: "Falling hazards, prioritized.", ja: "落下・転倒リスクを優先順位付け。" },
    hazardsBody: { en: "A room-aware quake score and a priced anchoring shopping list.", ja: "部屋ごとの地震対策スコアと、概算価格付きの固定具リストです。" },
    privacyNote: { en: "Fresh JPEGs are created without GPS or photo metadata. Original uploaded files are not retained.", ja: "GPSや写真のメタデータを除いた新しいJPEGを作成します。元のアップロード画像は保存しません。" },
    activeInventory: { en: "Active inventory", ja: "現在の家財台帳" },
    newInventory: { en: "New inventory", ja: "新しい家財台帳" },
    roomFleet: { en: "Room fleet", ja: "部屋の処理状況" },
    startingWorkers: { en: "Starting workers…", ja: "ワーカーを起動しています…" },
    gpuQueue: { en: "GPU queue", ja: "GPU待ち行列" },
    waitingCapacity: { en: "Waiting for capacity", ja: "処理枠を待機中" },
    noRooms: { en: "No rooms made it into the ledger.", ja: "台帳に追加できた部屋がありません。" },
    evidenceLedger: { en: "Evidence ledger", ja: "証拠台帳" },
    selectEvidence: { en: "Select a numbered box or item to inspect its evidence.", ja: "番号の枠または項目を選択して証拠を確認してください。" },
    numberedInventory: { en: "Numbered inventory", ja: "番号付き家財リスト" },
    runLog: { en: "Run log", ja: "実行ログ" },
    logPrivacy: { en: "Processing metadata only — never photo bytes.", ja: "処理メタデータのみ。写真のバイトデータは記録しません。" },
    disclaimer: { en: "AI estimates — verify with receipts. Not an insurance appraisal.", ja: "AIによる推定です。領収書で確認してください。保険の正式な鑑定ではありません。" },
    evidenceCorrection: { en: "Evidence correction", ja: "証拠情報の修正" },
    editItem: { en: "Edit item", ja: "項目を編集" },
    itemLabel: { en: "Item label", ja: "項目名" },
    replacementPrice: { en: "Replacement price (USD)", ja: "再調達価額（USD）" },
    condition: { en: "Condition", ja: "状態" },
    newCondition: { en: "New", ja: "新品" },
    goodCondition: { en: "Good", ja: "良好" },
    fairCondition: { en: "Fair", ja: "使用感あり" },
    poorCondition: { en: "Poor", ja: "状態が悪い" },
    receiptAvailable: { en: "Receipt available", ja: "領収書あり" },
    receiptProof: { en: "Mark this only when you have supporting proof.", ja: "証明できる領収書がある場合のみ選択してください。" },
    acvAfterSave: { en: "Actual cash value after saving", ja: "保存後の実際現金価額" },
    deleteItem: { en: "Delete item", ja: "項目を削除" },
    cancel: { en: "Cancel", ja: "キャンセル" },
    saveChanges: { en: "Save changes", ja: "変更を保存" },
    keepItem: { en: "Keep item", ja: "項目を残す" },
    deleteConfirmTitle: { en: "Delete this item?", ja: "この項目を削除しますか？" },
    deleteConfirmBody: { en: "The item will be removed from this browser ledger and exports. Its original inventory number will not be reassigned.", ja: "この項目はブラウザ上の台帳と各出力から削除されます。元の項目番号は他の項目に割り当て直されません。" },
    categoryElectronics: { en: "Electronics", ja: "電子機器" },
    categoryFurniture: { en: "Furniture", ja: "家具" },
    categoryAppliance: { en: "Appliance", ja: "家電" },
    categoryKitchenware: { en: "Kitchenware", ja: "キッチン用品" },
    categoryDecor: { en: "Decor", ja: "インテリア" },
    categoryClothing: { en: "Clothing", ja: "衣類" },
    categorySports: { en: "Sports", ja: "スポーツ用品" },
    categoryMusical: { en: "Musical", ja: "楽器" },
    categoryOther: { en: "Other", ja: "その他" },
    roomBedroom: { en: "bedroom", ja: "寝室" },
    roomLiving: { en: "living room", ja: "居間" },
    roomKitchen: { en: "kitchen", ja: "台所" },
    roomOffice: { en: "office", ja: "書斎" },
    roomOther: { en: "other", ja: "その他" },
    checkingWorkspace: { en: "Checking workspace…", ja: "実行環境を確認しています…" },
    workspaceUnavailable: { en: "Workspace status unavailable · sample may still work", ja: "実行環境を確認できません · サンプルは利用できる場合があります" },
    localRooms: { en: "Local: up to {count} rooms", ja: "ローカル: 最大{count}部屋" },
    daytonaConfigured: { en: "Daytona: live sandboxes configured", ja: "Daytona: ライブサンドボックス設定済み" },
    daytonaLive: { en: "Daytona: live sandboxes", ja: "Daytona: ライブサンドボックス" },
    localDecoding: { en: "Local: in-process decoding", ja: "ローカル: プロセス内で画像処理" },
    demoLocal: { en: "Demo: local processing", ja: "デモ: ローカル処理" },
    nosanaChecking: { en: "Nosana: checking", ja: "Nosana: 確認中" },
    nosanaUnused: { en: "Nosana: not used · offline mock", ja: "Nosana: 未使用 · オフラインモック" },
    nosanaConfigured: { en: "Nosana: {model} · configured", ja: "Nosana: {model} · 設定済み" },
    nosanaSample: { en: "Nosana: cached sample · no live calls", ja: "Nosana: キャッシュ済みサンプル · ライブ通信なし" },
    nosanaSourceLive: { en: "Nosana: {model} · live", ja: "Nosana: {model} · ライブ" },
    nosanaSourceCache: { en: "Nosana: {model} · cache", ja: "Nosana: {model} · キャッシュ" },
    nosanaSourceMock: { en: "Nosana: {model} · offline mock", ja: "Nosana: {model} · オフラインモック" },
    contextSample: { en: "Cached offline demo · bundled model responses · no live cloud inference", ja: "キャッシュ済みオフライン · 同梱のモデル応答 · クラウド推論なし" },
    contextLive: { en: "Live Daytona sandboxes · inference reported per room · {count} rooms maximum in parallel", ja: "ライブDaytonaサンドボックス · 部屋ごとの推論状況 · 最大{count}部屋を並列処理" },
    contextLocal: { en: "Local processing · no remote sandboxes · inference source reported per room · up to {count} rooms", ja: "ローカル処理 · リモートサンドボックスなし · 部屋ごとの推論元 · 最大{count}部屋" },
    readingOne: { en: "Reading 1 room", ja: "1部屋を分析中" },
    readingRooms: { en: "Reading {count} rooms", ja: "{count}部屋を分析中" },
    openingRun: { en: "Opening the run and preparing private room workers…", ja: "実行を開始し、部屋ごとのプライベートワーカーを準備しています…" },
    preparingOne: { en: "Preparing 1 room photo.", ja: "1枚の部屋写真を準備しています。" },
    preparingRooms: { en: "Preparing {count} room photos.", ja: "{count}枚の部屋写真を準備しています。" },
    roomsReturned: { en: "{done} of {total} rooms returned", ja: "{total}部屋中{done}部屋が完了" },
    roomsFailed: { en: "{count} failed", ja: "{count}件失敗" },
    queueActive: { en: "{active} active · {waiting} waiting", ja: "{active}件処理中 · {waiting}件待機" },
    queueSlots: { en: "{count} concurrent inference slots", ja: "同時推論は{count}枠" },
    queueSlot: { en: "1 concurrent inference slot", ja: "同時推論は1枠" },
    queueClosed: { en: "Inference queue closed", ja: "推論待ち行列を終了しました" },
    gpuAria: { en: "GPU queue: {active} active, {waiting} waiting, limit {limit}", ja: "GPU待ち行列: {active}件処理中、{waiting}件待機、上限{limit}" },
    queueWaiting: { en: "GPU limit reported by queue events · room limit {count}", ja: "GPU上限は待ち行列イベントを参照 · 部屋の上限{count}" },
    queued: { en: "queued", ja: "待機中" },
    creating: { en: "creating", ja: "作成中" },
    sanitizing: { en: "sanitizing", ja: "画像を無害化中" },
    detecting: { en: "detecting (GPU)", ja: "検出中（GPU）" },
    scoring: { en: "scoring", ja: "評価中" },
    refining: { en: "refining", ja: "高精度確認中" },
    released: { en: "released", ja: "解放済み" },
    destroyedLabel: { en: "destroyed ✓", ja: "削除済み ✓" },
    errorState: { en: "error", ja: "エラー" },
    cleanupFailed: { en: "cleanup failed", ja: "削除失敗" },
    pending: { en: "pending", ja: "待機中" },
    elapsed: { en: "elapsed", ja: "経過時間" },
    tileProgress: { en: "{name} processing progress", ja: "{name}の処理進捗" },
    latestSource: { en: "Latest inference source: {source}", ja: "最新の推論元: {source}" },
    noInferenceYet: { en: "No inference event yet", ja: "推論イベントはまだありません" },
    cleanupReview: { en: "Cleanup needs review", ja: "削除状態の確認が必要です" },
    cleanupReviewLong: { en: "Sandbox deletion needs review", ja: "サンドボックス削除の確認が必要です" },
    destroyedPlain: { en: "Remote sandbox destroyed.", ja: "リモートサンドボックスを削除しました。" },
    releasedPlain: { en: "Local room worker released.", ja: "ローカルワーカーを解放しました。" },
    sampleLog: { en: "Cached offline demo: six sample rooms use bundled responses, not live cloud inference.", ja: "キャッシュ済みデモ: 6部屋のサンプルは同梱の応答を使用し、ライブのクラウド推論は行いません。" },
    roomAdded: { en: "{room} added {count} items to the ledger.", ja: "{room}の{count}項目を台帳に追加しました。" },
    duplicateFlags: { en: "{count} possible duplicates flagged. Every item remains in the inventory.", ja: "{count}件の重複候補を確認できます。すべての項目が台帳に残っています。" },
    duplicateFlag: { en: "1 possible duplicate flagged. Every item remains in the inventory.", ja: "1件の重複候補があります。すべての項目が台帳に残っています。" },
    roomErrorPlain: { en: "This room could not be processed. Other rooms continue.", ja: "この部屋は処理できませんでした。他の部屋の処理は続行します。" },
    allWorkersDone: { en: "All room workers have finished.", ja: "すべての部屋の処理が完了しました。" },
    workersDoneErrors: { en: "The run finished with room errors. Usable room evidence remains available.", ja: "一部の部屋でエラーが発生しました。利用可能な証拠は引き続き確認できます。" },
    runFinished: { en: "Run finished", ja: "処理完了" },
    noItemsReturned: { en: "No visible household items or rooms were returned. Try a clearer set of photos.", ja: "家財や部屋を検出できませんでした。より鮮明な写真をお試しください。" },
    failureCount: { en: "{count} room workers reported an error. Check the technical log and try different photos.", ja: "{count}部屋でエラーが発生しました。技術ログを確認し、別の写真をお試しください。" },
    failureOne: { en: "1 room worker reported an error. Check the technical log and try different photos.", ja: "1部屋でエラーが発生しました。技術ログを確認し、別の写真をお試しください。" },
    runInterrupted: { en: "Run interrupted · local evidence retained in this tab", ja: "処理中断 · このタブの証拠は保持されています" },
    streamEnded: { en: "The analysis stream ended unexpectedly.", ja: "分析ストリームが予期せず終了しました。" },
    stoppedEvidence: { en: "The run stopped before completion. Any returned rooms can still be edited and exported.", ja: "処理は完了前に停止しました。取得済みの部屋は編集・出力できます。" },
    interruptedTitle: { en: "Run interrupted — partial ledger", ja: "処理中断 — 一部の台帳" },
    couldNotStart: { en: "Could not start the run", ja: "処理を開始できませんでした" },
    analysisInterrupted: { en: "Analysis interrupted", ja: "分析を中断しました" },
    runComplete: { en: "Run complete", ja: "処理完了" },
    runErrors: { en: "Run finished with room errors", ja: "部屋のエラーがありました" },
    cachedComplete: { en: "Cached sample complete", ja: "キャッシュ済みサンプルが完了" },
    localComplete: { en: "Local inventory complete", ja: "ローカルの家財台帳が完了" },
    liveComplete: { en: "Live inventory complete", ja: "ライブの家財台帳が完了" },
    roomsItemsTime: { en: "{rooms} rooms · {count} items · {duration}s", ja: "{rooms}部屋 · {count}項目 · {duration}秒" },
    summaryLocal: { en: "{rooms} rooms · {workers} local workers · {items} items · {duration}s · {retained} uploaded photo files retained", ja: "{rooms}部屋 · {workers}個のローカルワーカー · {items}項目 · {duration}秒 · アップロード写真の保存{retained}件" },
    summaryLive: { en: "{rooms} rooms · {sandboxes} sandboxes in parallel · {items} items · {duration}s · {retained} uploaded photo files retained", ja: "{rooms}部屋 · {sandboxes}個のサンドボックスを並列実行 · {items}項目 · {duration}秒 · アップロード写真の保存{retained}件" },
    allDestroyed: { en: "all destroyed", ja: "すべて削除済み" },
    cleanupNeedsReview: { en: "cleanup needs review", ja: "削除状態の確認が必要" },
    failedSuffix: { en: "{count} failed", ja: "{count}件失敗" },
    httpStatus: { en: "The server returned HTTP {status}.", ja: "サーバーがHTTP {status}を返しました。" },
    streamOpened: { en: "Analyze stream opened · HTTP {status} · {count} files", ja: "分析ストリーム開始 · HTTP {status} · {count}ファイル" },
    noSamples: { en: "No bundled sample photos are available.", ja: "同梱のサンプル写真がありません。" },
    sampleLoadError: { en: "Could not load sample room {count}.", ja: "サンプル部屋{count}を読み込めませんでした。" },
    sampleGenericError: { en: "The sample home could not be loaded.", ja: "サンプルホームを読み込めませんでした。" },
    malformedEvent: { en: "Skipped malformed event: {message}", ja: "不正なイベントをスキップ: {message}" },
    ignoredEvent: { en: "Ignored unsupported event type: {type}", ja: "未対応のイベント種別を無視: {type}" },
    chooseMaxFiles: { en: "Choose at most 8 room photos for one inventory.", ja: "家財台帳1回分の写真は8枚まで選択できます。" },
    invalidFileType: { en: "{file} must be JPEG, PNG, or WebP.", ja: "{file}はJPEG、PNG、WebP形式で選択してください。" },
    oversizedFile: { en: "{file} is empty or larger than 12 MB.", ja: "{file}は空のファイルか、12MBを超えています。" },
    roomPrefix: { en: "Room {count}", ja: "部屋{count}" },
    roomGeneric: { en: "Room {count}", ja: "部屋{count}" },
    logEmptyPlain: { en: "Room updates will appear here.", ja: "部屋の更新状況がここに表示されます。" },
    logEmptyTechnical: { en: "Run IDs, workers, models and cleanup metadata will appear here.", ja: "実行ID、ワーカー、モデル、削除メタデータがここに表示されます。" },
    imageOmitted: { en: "[image omitted]", ja: "[画像を省略]" },
    runIdLog: { en: "Run {id} · {mode} · {inference} · model {model}", ja: "実行 {id} · {mode} · {inference} · モデル {model}" },
    daytonaLiveMode: { en: "Daytona live mode", ja: "Daytonaライブモード" },
    localWorkerMode: { en: "Local worker mode", ja: "ローカルワーカーモード" },
    inferenceLog: { en: "Inference {source} · {model}", ja: "推論元 {source} · {model}" },
    modelUnavailable: { en: "model unavailable", ja: "モデル情報なし" },
    summaryLog: { en: "Summary · {rooms} rooms · {sandboxes} sandboxes · {destroyed} destroyed · {retained} uploaded files retained", ja: "概要 · {rooms}部屋 · {sandboxes}サンドボックス · {destroyed}個削除 · アップロード写真の保存{retained}件" },
    unknownRoomError: { en: "Unknown room error", ja: "不明な部屋エラー" },
    unknownParseError: { en: "unknown parse error", ja: "不明な解析エラー" },
    roomProcessingFailed: { en: "Room processing failed", ja: "部屋の処理に失敗しました" },
    roomNumber: { en: "ROOM {number}", ja: "部屋 {number}" },
    gpsRemoved: { en: "GPS and photo metadata removed", ja: "GPSと写真のメタデータを削除しました" },
    sandboxGpsRemoved: { en: "Sandbox {id} removed GPS and photo metadata", ja: "サンドボックス{id}でGPSと写真のメタデータを削除しました" },
    refiningItems: { en: "Refining {count} high-value items…", ja: "高額の{count}項目を詳細確認しています…" },
    refinementSkipped: { en: "Refinement skipped: {error}; original estimate retained", ja: "詳細確認を省略: {error}。元の推定値を保持しました" },
    metadataRemoved: { en: "Metadata removed · sanitized JPEG", ja: "メタデータ削除済み · 無害化JPEG" },
    sanitizedEvidence: { en: "Sanitized evidence image", ja: "無害化された証拠画像" },
    noItemsRoom: { en: "No items remain in this room. Deleted item numbers are not reassigned.", ja: "この部屋には項目がありません。削除した番号は他の項目に割り当て直されません。" },
    householdItem: { en: "Household item", ja: "家財項目" },
    itemAria: { en: "Item {number}: {label}", ja: "項目{number}: {label}" },
    photoAria: { en: "{room}: original sanitized room photograph", ja: "{room}: 無害化された元の証拠写真" },
    boxesAria: { en: "{room} numbered item boxes", ja: "{room}の番号付き項目枠" },
    unavailable: { en: "Unavailable", ja: "利用できません" },
    unavailableLower: { en: "unavailable", ja: "利用できません" },
    hashLabel: { en: "SHA-256 {hash}", ja: "SHA-256 {hash}" },
    possibleDuplicateShort: { en: "possible duplicate", ja: "重複の可能性" },
    verified: { en: "Verified ✓", ja: "確認済み ✓" },
    evidenceCropAlt: { en: "Evidence crop: {label}", ja: "証拠の切り抜き: {label}" },
    evidenceCropUnavailable: { en: "Evidence crop unavailable", ja: "証拠の切り抜きを利用できません" },
    replacement: { en: "Replacement", ja: "再調達価額" },
    actualCash: { en: "Actual cash value", ja: "実際現金価額" },
    priceAdjusted: { en: "⚠ AI estimate adjusted to typical range", ja: "⚠ AIの推定額を一般的な範囲に調整しました" },
    priceFlagHint: { en: "The AI estimate was outside the typical category range and has been clamped.", ja: "AIの推定額がカテゴリの一般的な範囲外だったため、上限・下限内に調整しました。" },
    estimatedAge: { en: "Estimated age", ja: "推定使用年数" },
    yearsValue: { en: "{count} years", ja: "{count}年" },
    yearValue: { en: "1 year", ja: "1年" },
    confidence: { en: "Confidence", ja: "確信度" },
    brandModel: { en: "Brand / model", ja: "ブランド / モデル" },
    notIdentified: { en: "Not visibly identified", ja: "画像からは特定できません" },
    receipt: { en: "Receipt", ja: "領収書" },
    availableCheck: { en: "Available ✓", ja: "あり ✓" },
    notMarked: { en: "Not marked", ja: "未選択" },
    boxCoordinates: { en: "Box coordinates", ja: "枠の座標" },
    roomFingerprint: { en: "Room fingerprint", ja: "部屋の証拠フィンガープリント" },
    possibleDuplicate: { en: "⚠ Possible duplicate", ja: "⚠ 重複の可能性" },
    duplicateExplanation: { en: "Matches {id}. Confirm the relationship or dismiss it — the item will not be deleted.", ja: "{id}と一致する可能性があります。関係を確認するかフラグを解除してください。項目は自動削除されません。" },
    confirmDuplicate: { en: "Confirm duplicate", ja: "重複を確認" },
    dismissFlag: { en: "Dismiss flag", ja: "フラグを解除" },
    confirmedDuplicate: { en: "Confirmed duplicate of {id} · kept in ledger and exports.", ja: "{id}の重複として確認 · 台帳と出力には残ります。" },
    undoConfirmation: { en: "Undo confirmation", ja: "確認を取り消す" },
    dismissedDuplicate: { en: "Duplicate flag dismissed · item retained.", ja: "重複フラグを解除 · 項目は残っています。" },
    editItemNumber: { en: "Edit item {number}", ja: "項目{number}を編集" },
    invalidEdit: { en: "Enter an item label and a replacement price from $0 to $1,000,000.", ja: "項目名と、0〜1,000,000 USDの再調達価額を入力してください。" },
    deleteNamed: { en: "Delete “{label}” from this browser ledger and exports? Original inventory number {number} will not be reassigned.", ja: "「{label}」をブラウザ上の台帳と各出力から削除しますか？元の項目番号{number}は他の項目に割り当て直されません。" },
    reportBlocked: { en: "Report blocked", ja: "レポートを開けません" },
    allowPopup: { en: "Allow pop-ups for this site, then choose Print report again.", ja: "このサイトのポップアップを許可してから、もう一度「レポート印刷」を選択してください。" },
    themeHint: { en: "Change color theme; reports stay light for printing", ja: "カラーテーマを変更。レポートは印刷用にライト表示を維持" },
    languageHint: { en: "Change interface language", ja: "表示言語を変更" },
    switchJapanese: { en: "Switch interface to Japanese", ja: "日本語に切り替える" },
    switchEnglish: { en: "Switch interface to English", ja: "英語に切り替える" },
    applicationActions: { en: "Application settings and inventory actions", ja: "アプリ設定と家財台帳の操作" },
    outputs: { en: "What RoomLedger produces", ja: "RoomLedgerで作成できるもの" },
    fleetAria: { en: "Room processing states", ja: "部屋の処理状態" },
    currentTotals: { en: "Current edited inventory totals", ja: "編集後の家財台帳の合計" },
    inventoryView: { en: "Inventory view", ja: "家財台帳の表示" },
    roomsNav: { en: "Rooms", ja: "部屋一覧" },
    itemInspector: { en: "Item evidence inspector", ja: "項目の証拠インスペクター" },
    logDetail: { en: "Log detail", ja: "ログの詳細" },
    appTitle: { en: "RoomLedger — Home inventory & quake readiness", ja: "RoomLedger — 家財台帳と地震対策" },
    appDescription: { en: "RoomLedger turns room photos into an editable disaster inventory with evidence crops, replacement values, and earthquake safety actions.", ja: "RoomLedgerは部屋の写真から、証拠画像、再調達価額、地震対策を含む編集可能な災害家財台帳を作成します。" },
    secondsShort: { en: "s", ja: "秒" },
    otherRoomsUnaffected: { en: "This room could not be processed. Other rooms are unaffected.", ja: "この部屋は処理できませんでした。他の部屋への影響はありません。" },
    switchLightTheme: { en: "Switch to light mode", ja: "ライトモードに切り替える" },
    switchDarkTheme: { en: "Switch to dark mode", ja: "ダークモードに切り替える" },
    reportComplete: { en: "Inventory complete", ja: "家財台帳が完了しました" },
    runFinishedErrors: { en: "Run finished with errors", ja: "エラーがありました" },
    reportInventory: { en: "Consolidated inventory", ja: "家財一覧" },
    reportInventoryNote: { en: "Verified / receipt columns reflect AI refinement and user-marked proof respectively. Deleted items are excluded; original item numbers remain stable.", ja: "確認済みはAIによる詳細確認、領収書はユーザーによる証明情報を示します。削除項目は含まれず、元の項目番号は維持されます。" },
    reportCrop: { en: "Crop", ja: "切り抜き" },
    reportRoomId: { en: "Room / ID", ja: "部屋 / ID" },
    reportItemBrand: { en: "Item / brand", ja: "項目 / ブランド" },
    reportCategory: { en: "Category", ja: "カテゴリ" },
    reportConditionAge: { en: "Condition / age", ja: "状態 / 使用年数" },
    reportVerifiedReceipt: { en: "Verified / receipt", ja: "確認済み / 領収書" },
    noItemsInventory: { en: "No items remain in the inventory.", ja: "台帳に項目がありません。" },
    sanitizedJpeg: { en: "Sanitized JPEG", ja: "無害化JPEG" },
    gpsMetadataRemoved: { en: "GPS & metadata removed", ja: "GPSとメタデータを削除済み" },
    photoEvidenceAlt: { en: "{room} sanitized evidence photo", ja: "{room}の無害化された証拠写真" },
    numberedBoxes: { en: "Numbered item boxes", ja: "番号付き項目枠" },
    photoEvidenceFingerprint: { en: "Photo evidence fingerprint", ja: "写真の証拠フィンガープリント" },
    timestampUnavailable: { en: "Timestamp unavailable", ja: "タイムスタンプなし" },
    product: { en: "Product", ja: "製品" },
    estimatedJpy: { en: "Estimated JPY", ja: "概算 JPY" },
    perYear: { en: "% per year", ja: "%／年" },
    reportTitle: { en: "RoomLedger evidence report", ja: "RoomLedger 証拠レポート" },
    printSavePdf: { en: "Print / Save PDF", ja: "印刷 / PDF保存" },
    reportCoverTitleA: { en: "Home evidence &", ja: "家財の証拠と" },
    reportCoverTitleB: { en: "quake-readiness report", ja: "地震対策レポート" },
    reportLead: { en: "A room-by-room record of visible household property, item evidence, current replacement values, actual cash values and practical falling-hazard actions.", ja: "部屋ごとに、家財、証拠画像、再調達価額、実際現金価額、落下・転倒への具体的な対策を記録します。" },
    prepared: { en: "Prepared {date}", ja: "作成日 {date}" },
    runLabel: { en: "Run {id}", ja: "実行 {id}" },
    shoppingExplanation: { en: "Quantities are generated from fix_keys for every current medium or high-risk item. Prices are rough Japanese retail estimates, not quotations.", ja: "現在の中・高リスク項目のfix_keysから数量を集計しています。価格は日本の一般的な小売価格の概算で、見積書ではありません。" },
    appendixTitle: { en: "Appendix: method & evidence", ja: "付録: 算出方法と証拠" },
    methodImage: { en: "Photos are decoded, EXIF/GPS metadata is removed, and a fresh sanitized JPEG is created. AI-identified objects receive normalized 0–1000 boxes and evidence crops. Item labels, brands, conditions and values remain estimates until checked.", ja: "写真をデコードし、EXIF/GPSメタデータを削除して、新しい無害化JPEGを作成します。AIが検出した品目には0〜1000の正規化座標の枠と証拠の切り抜きを付与します。項目名、ブランド、状態、価額は確認されるまで推定値です。" },
    methodAcv: { en: "Actual cash value = replacement × condition factor × (1 − annual category depreciation)^age. Age is clamped to 0–50 years. Condition factors: new 1.00, good 0.85, fair 0.65, poor 0.35. Edits recalculate totals in this browser.", ja: "実際現金価額 = 再調達価額 × 状態係数 ×（1 − カテゴリ別年間減価率）^使用年数。使用年数は0〜50年に制限します。状態係数は新品1.00、良好0.85、使用感あり0.65、状態が悪い0.35です。編集するとブラウザ内で合計を再計算します。" },
    annualDepreciation: { en: "Annual depreciation", ja: "年間減価率" },
    readinessFormula: { en: "Readiness score = 100 − (8 per high-risk item + 3 per medium-risk item), with bedroom penalties ×1.5, divided by the square root of analyzed room count. Bedroom items near a bed or exit are prioritized. This is a triage aid, not a structural engineering or evacuation assessment.", ja: "地震対策スコア = 100 −（高リスク項目×8 + 中リスク項目×3）に、寝室のリスクを1.5倍し、分析部屋数の平方根で割った値です。寝室のベッドや出口の近くにある項目を優先します。優先順位付けの目安であり、建物の構造工学や避難経路の評価ではありません。" },
    methodDedupe: { en: "Possible duplicates are flagged for human confirmation and never silently removed. Photo SHA-256 fingerprints appear with each original sanitized room photograph. CSV cells are protected against spreadsheet formula injection.", ja: "重複候補には確認用のフラグを付け、自動では削除しません。各無害化写真にSHA-256フィンガープリントを表示します。CSVセルはスプレッドシートの数式インジェクションから保護されます。" },
    photoFingerprints: { en: "Photo evidence fingerprints", ja: "写真の証拠フィンガープリント一覧" },
    roomLabel: { en: "Room", ja: "部屋" },
    sanitizedHash: { en: "Sanitized JPEG SHA-256", ja: "無害化JPEG SHA-256" },
    utcTimestamp: { en: "UTC processing timestamp", ja: "UTC処理タイムスタンプ" },
    reportGenerated: { en: "Generated locally from the current edited browser ledger. No external report resources are loaded.", ja: "ブラウザで編集した現在の台帳からローカルに作成しました。外部のレポートリソースは読み込みません。" },
    disclaimerEnglish: { en: "AI estimates — verify with receipts. Not an insurance appraisal.", ja: "AI estimates — verify with receipts. Not an insurance appraisal." },
    detectedItemsLog: { en: "{source} · {model} · {count} detections", ja: "{source} · {model} · {count}件を検出" },
    sandboxDeletedLog: { en: "Daytona sandbox {id} destroyed", ja: "Daytonaサンドボックス{id}を削除しました" },
    startupRemoved: { en: "Startup removed {count} leftover RoomLedger sandboxes", ja: "起動時に残っていた{count}個のRoomLedgerサンドボックスを削除しました" },
    startupSweepFailed: { en: "Daytona orphan sweep could not complete: {error}", ja: "Daytonaの孤立サンドボックス削除を完了できませんでした: {error}" },
    deletionReviewType: { en: "Deletion needs review: {error}", ja: "削除状態の確認が必要です: {error}" },
    closeEditor: { en: "Close editor", ja: "編集を閉じる" },
    dismissSummary: { en: "Dismiss summary", ja: "完了メッセージを閉じる" },
  };

  const JA = {
    readiness: "地震対策スコア",
    readinessSummary: "家具などの倒れやすさを数えた相対スコアです。建物の構造安全性を示すものではありません。",
    readinessGood: "比較的安定・予防対策を継続",
    readinessFair: "中・高リスクの家具を固定",
    readinessLow: "高リスクの項目を優先",
    shopping: "転倒防止の買い物リスト",
    estimated: "見積もり",
    noFixes: "固定具が必要な中・高リスク項目はありません。",
    high: "高リスク",
    medium: "中リスク",
    low: "低リスク",
    sleeping: "就寝中に下敷きになる可能性",
    sleepingShort: "寝室の優先項目",
    reasonTitle: "落下・転倒の理由",
    highReason: "大きな揺れで倒れたり、落下したりする可能性があります。",
    mediumReason: "転倒や衝突を防ぐため、配置と固定方法を確認してください。",
    lowReason: "大きな転倒リスクの特徴は検出されていません。",
    recommendedFix: "推奨する対策",
    roomHazards: "高リスク {count} 件",
    items: "{count} 項目",
    quantity: "数量",
    total: "合計",
  };

  const state = {
    health: null,
    files: [],
    running: false,
    runId: null,
    meta: null,
    rooms: new Map(),
    tiles: new Map(),
    deletedIds: new Set(),
    selectedRoom: null,
    selectedItem: null,
    mode: "insurance",
    language: document.documentElement.dataset.language === "ja" ? "ja" : "en",
    summary: null,
    done: false,
    interrupted: false,
    uploadError: null,
    failures: 0,
    cleanupFailed: false,
    logs: { plain: [], technical: [] },
    logTab: "plain",
    queue: { active: 0, waiting: 0, limit: 2, closed: false },
    toast: null,
  };

  const money0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const money2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const yen = new Intl.NumberFormat("en-US", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svgEl(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    node.replaceChildren();
    return node;
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function photoUrl(value) {
    return typeof value === "string" && /^data:image\/jpeg;base64,[a-z0-9+/=\s]+$/i.test(value) ? value : "";
  }

  function acvFor(item) {
    const category = Object.hasOwn(DEPRECIATION, item.category) ? item.category : "other";
    const condition = Object.hasOwn(CONDITION_FACTOR, item.condition) ? item.condition : "fair";
    const age = Math.min(50, Math.max(0, Math.trunc(finite(item.age_years, 0))));
    const retained = (1 - DEPRECIATION[category]) ** age;
    return Math.round(finite(item.replacement_usd) * CONDITION_FACTOR[condition] * retained * 100) / 100;
  }

  function allRooms() {
    return [...state.rooms.values()].sort((a, b) => a.index - b.index);
  }

  function findItem(id) {
    for (const room of state.rooms.values()) {
      const item = room.items.find((candidate) => candidate.id === id);
      if (item) return { room, item };
    }
    return null;
  }

  function t(key) {
    return state.language === "ja" && JA[key] ? JA[key] : ({
      readiness: "Quake readiness",
      readinessSummary: "A relative tip-over risk score, not a structural safety rating.",
      readinessGood: "Comparatively stable · keep prevention in place",
      readinessFair: "Secure medium and high-risk items",
      readinessLow: "Secure high-risk items first",
      shopping: "Anchoring shopping list",
      estimated: "estimated",
      noFixes: "No medium or high-risk items currently require brackets or straps.",
      high: "High risk",
      medium: "Medium risk",
      low: "Low risk",
      sleeping: "Could fall on you while sleeping",
      sleepingShort: "Sleeping-area priority",
      reasonTitle: "Tip-over evidence",
      recommendedFix: "Recommended fixes",
      items: "{count} items",
    }[key] || key);
  }

  function sharedText(key, values = {}) {
    let text = UI_TEXT[key]?.[state.language] || UI_TEXT[key]?.en || key;
    Object.entries(values).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  }

  function categoryText(category) {
    return sharedText({ electronics: "categoryElectronics", furniture: "categoryFurniture", appliance: "categoryAppliance", kitchenware: "categoryKitchenware", decor: "categoryDecor", clothing: "categoryClothing", sports: "categorySports", musical: "categoryMusical" }[category] || "categoryOther");
  }

  function conditionText(condition) {
    return sharedText({ new: "newCondition", good: "goodCondition", fair: "fairCondition", poor: "poorCondition" }[condition] || "fairCondition");
  }

  function localizedMessage(message) {
    if (state.language === "en" || typeof message !== "string") return message;
    const exact = Object.entries(UI_TEXT).find(([, copy]) => copy.en === message);
    if (exact) return exact[1].ja;
    let match = message.match(/^Preparing (\d+) room (photo|photos)\.$/);
    if (match) return sharedText(match[1] === "1" ? "preparingOne" : "preparingRooms", { count: match[1] });
    match = message.match(/^(.+) added (\d+) (item|items) to the ledger\.$/);
    if (match) return sharedText("roomAdded", { room: match[1], count: match[2] });
    match = message.match(/^Refining (\d+) high-value items…$/);
    if (match) return sharedText("refiningItems", { count: match[1] });
    match = message.match(/^(\d+) possible duplicates? flagged\. Every item remains in the inventory\.$/);
    if (match) return sharedText(match[1] === "1" ? "duplicateFlag" : "duplicateFlags", { count: match[1] });
    match = message.match(/^Run ([^ ]+) · (.+) · (.+) · model (.+)$/);
    if (match) return sharedText("runIdLog", { id: match[1], mode: localizedMessage(match[2]), inference: match[3], model: match[4] });
    match = message.match(/^Inference (live|cache|mock|unknown) · (.+)$/);
    if (match) return sharedText("inferenceLog", { source: match[1], model: match[2] === "model unavailable" ? sharedText("modelUnavailable") : match[2] });
    match = message.match(/^Analyze stream opened · HTTP (\d+) · (\d+) files$/);
    if (match) return sharedText("streamOpened", { status: match[1], count: match[2] });
    match = message.match(/^Summary · (\d+) rooms · (\d+) sandboxes · (\d+) destroyed · (\d+) uploaded files retained$/);
    if (match) return sharedText("summaryLog", { rooms: match[1], sandboxes: match[2], destroyed: match[3], retained: match[4] });
    match = message.match(/^Skipped malformed event: (.+)$/);
    if (match) return sharedText("malformedEvent", { message: match[1] === "unknown parse error" ? sharedText("unknownParseError") : match[1] });
    match = message.match(/^Ignored unsupported event type: (.+)$/);
    if (match) return sharedText("ignoredEvent", { type: match[1] });
    match = message.match(/^Refinement skipped: (\w+); original estimate retained$/);
    if (match) return sharedText("refinementSkipped", { error: match[1] });
    match = message.match(/^Sandbox ([a-f0-9]+) removed GPS and photo metadata$/i);
    if (match) return sharedText("sandboxGpsRemoved", { id: match[1] });
    match = message.match(/^(LIVE|CACHE|MOCK) · (.+) · (\d+) detections(?: · HTTP (\d+) ms)?$/);
    if (match) return sharedText("detectedItemsLog", { source: match[1], model: match[2], count: match[3] }) + (match[4] ? ` · HTTP ${match[4]} ms` : "");
    match = message.match(/^Daytona sandbox (\S+) destroyed$/);
    if (match) return sharedText("sandboxDeletedLog", { id: match[1] });
    match = message.match(/^Startup removed (\d+) leftover RoomLedger sandboxes$/);
    if (match) return sharedText("startupRemoved", { count: match[1] });
    match = message.match(/^Daytona orphan sweep could not complete: (.+)$/);
    if (match) return sharedText("startupSweepFailed", { error: match[1] });
    match = message.match(/^Deletion needs review: (.+)$/);
    if (match) return sharedText("deletionReviewType", { error: match[1] });
    return message;
  }

  function translateSharedUI() {
    document.querySelectorAll("[data-ui-text]").forEach((node) => { node.textContent = sharedText(node.dataset.uiText); });
    document.querySelectorAll("[data-ui-aria]").forEach((node) => node.setAttribute("aria-label", sharedText(node.dataset.uiAria)));
    document.title = sharedText("appTitle");
    document.querySelector('meta[name="description"]').content = sharedText("appDescription");
    $("theme-toggle").title = sharedText("themeHint");
    $("language-toggle").title = sharedText("languageHint");
    $("theme-label").textContent = sharedText(document.documentElement.dataset.theme === "dark" ? "themeLight" : "themeDark");
  }

  function riskLabel(risk) {
    return t(Object.hasOwn(JA, risk) ? risk : "low");
  }

  function roomTypeLabel(room) {
    const type = room.room_type.replaceAll("_", " ");
    if (state.language !== "ja") return type;
    return sharedText({ bedroom: "roomBedroom", living_room: "roomLiving", kitchen: "roomKitchen", office: "roomOffice" }[room.room_type] || "roomOther");
  }

  function localizedItemCount(count) {
    return state.language === "ja" ? JA.items.replace("{count}", count) : `${count} items`;
  }

  function fixName(key) {
    return FIXES[key] ? FIXES[key][state.language] : key;
  }

  function localizedRiskReason(item) {
    if (state.language !== "ja") return item.risk_reason || "No detailed risk reason was supplied.";
    return item.risk === "high" ? JA.highReason : item.risk === "medium" ? JA.mediumReason : JA.lowReason;
  }

  function setBusy(busy) {
    state.running = busy;
    $("sample-button").disabled = busy;
    $("file-input").disabled = busy;
    $("clear-files").disabled = busy;
    $("analyze-button").disabled = busy || state.files.length === 0;
    $("reset-button").hidden = busy || !state.done;
  }

  function setTheme(theme) {
    const selected = theme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.dataset.theme = selected;
    try { localStorage.setItem("roomledger-theme", selected); } catch (_) { /* Theme still works without storage. */ }
    const dark = selected === "dark";
    $("theme-toggle").setAttribute("aria-pressed", String(dark));
    $("theme-toggle").setAttribute("aria-label", sharedText(dark ? "switchLightTheme" : "switchDarkTheme"));
    $("theme-label").textContent = sharedText(dark ? "themeLight" : "themeDark");
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0d1420" : "#f5f2eb";
    // Flush once, then restore transitions on the following frame (not a color smear).
    void document.body.offsetWidth;
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
  }

  function updateExportAvailability() {
    const available = allRooms().length > 0;
    $("csv-button").disabled = !available;
    $("report-button").disabled = !available;
  }

  function showUploadError(key, params = {}) {
    state.uploadError = key ? { key, params } : null;
    $("upload-error").textContent = key ? sharedText(key, params) : "";
    $("upload-error").hidden = !key;
  }

  function setEnvironment({ text, status = "ok" }) {
    const container = clear($("environment-status"));
    const light = el("span", `status-light${status === "checking" ? " is-checking" : status === "error" ? " is-error" : ""}`);
    light.setAttribute("aria-hidden", "true");
    container.append(light, el("span", "", text));
  }

  function setNosanaStatus(text, source = "waiting") {
    const pill = $("nosana-status");
    pill.textContent = text;
    pill.dataset.source = source;
    pill.title = text;
  }

  function updateEnvironmentText() {
    if (state.interrupted) {
      setEnvironment({ text: sharedText("runInterrupted"), status: "error" });
      return;
    }
    const meta = state.meta;
    if (meta) {
      setEnvironment({ text: meta.sample ? sharedText("demoLocal") : meta.daytona_mode === "live" ? sharedText("daytonaLive") : sharedText("localDecoding") });
      if (meta.sample) return setNosanaStatus(sharedText("nosanaSample"), "cache");
      const latest = [...state.tiles.values()].filter((tile) => tile.source).at(-1);
      if (latest) {
        const key = latest.source === "live" ? "nosanaSourceLive" : latest.source === "cache" ? "nosanaSourceCache" : "nosanaSourceMock";
        return setNosanaStatus(sharedText(key, { model: latest.model || meta.model }), latest.source);
      }
      const configured = meta.nosana_mode === "configured";
      return setNosanaStatus(configured ? sharedText("nosanaConfigured", { model: meta.model }) : sharedText("nosanaUnused"), configured ? "configured" : "mock");
    }
    if (!state.health) return;
    const local = state.health.daytona_mode !== "live";
    setEnvironment({ text: local ? sharedText("localRooms", { count: finite(state.health.parallel_limit, 8) }) : sharedText("daytonaConfigured") });
    const configured = state.health.nosana_mode === "configured";
    setNosanaStatus(configured ? sharedText("nosanaConfigured", { model: state.health.model }) : sharedText("nosanaUnused"), configured ? "configured" : "mock");
  }

  async function loadHealth() {
    try {
      const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Health check returned ${response.status}`);
      state.health = await response.json();
      updateEnvironmentText();
      if (state.health.cleanup_warning) addLog("technical", state.health.cleanup_warning, -1);
    } catch (error) {
      setEnvironment({ text: sharedText("workspaceUnavailable"), status: "error" });
      console.warn(error);
    }
  }

  function renderSelectedFiles() {
    const selected = state.files;
    $("selected-files").hidden = selected.length === 0;
    const list = clear($("selected-file-list"));
    selected.forEach((file) => {
      const row = el("div", "selected-file");
      row.append(el("span", "", file.name), el("span", "", `${(file.size / 1024 / 1024).toFixed(1)} MB`));
      list.append(row);
    });
    $("analyze-button").disabled = state.running || selected.length === 0;
  }

  function selectFiles(fileList) {
    showUploadError("");
    const files = [...fileList];
    if (!files.length) return;
    if (files.length > 8) {
      showUploadError("chooseMaxFiles");
      return;
    }
    const invalid = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalid) {
      showUploadError("invalidFileType", { file: invalid.name });
      return;
    }
    const oversized = files.find((file) => !file.size || file.size > 12 * 1024 * 1024);
    if (oversized) {
      showUploadError("oversizedFile", { file: oversized.name });
      return;
    }
    state.files = files;
    renderSelectedFiles();
  }

  function addLog(level, message, room = null) {
    if (!state.logs[level] || typeof message !== "string") return;
    const safeMessage = message.replace(/data:image\/[^;]+;base64,[a-z0-9+/=]+/gi, "[image omitted]");
    state.logs[level].push({ message: safeMessage.slice(0, 1000), room, time: new Date() });
    if (state.logs[level].length > 500) state.logs[level].shift();
    renderLogs();
  }

  function renderLogs() {
    ["plain", "technical"].forEach((level) => {
      const pane = clear($(`${level}-log`));
      if (!state.logs[level].length) {
        pane.append(el("div", "log-empty", sharedText(level === "plain" ? "logEmptyPlain" : "logEmptyTechnical")));
        return;
      }
      state.logs[level].forEach((entry) => {
        const row = el("div", "log-entry");
        const time = el("time", "", entry.time.toLocaleTimeString(state.language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        const prefix = Number.isInteger(entry.room) && entry.room >= 0 ? `${sharedText("roomPrefix", { count: entry.room + 1 })} · ` : "";
        row.append(time, el("span", "", prefix + localizedMessage(entry.message)));
        pane.append(row);
      });
      pane.scrollTop = pane.scrollHeight;
    });
  }

  function setLogTab(tab, focus = false) {
    state.logTab = tab;
    ["plain", "technical"].forEach((level) => {
      const selected = level === tab;
      const button = $(`${level}-log-tab`);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(`${level}-log`).hidden = !selected;
      if (selected && focus) button.focus();
    });
  }

  function prepareRun(files, meta = null) {
    state.files = files;
    state.meta = meta;
    state.rooms.clear();
    state.tiles.clear();
    state.deletedIds.clear();
    state.selectedRoom = null;
    state.selectedItem = null;
    state.summary = null;
    state.queue = { active: 0, waiting: 0, limit: 2, closed: false };
    state.toast = null;
    state.done = false;
    state.interrupted = false;
    state.uploadError = null;
    state.failures = 0;
    state.cleanupFailed = false;
    state.logs = { plain: [], technical: [] };
    files.forEach((file, index) => {
      state.tiles.set(index, { index, name: file.name.replace(/\.[^.]+$/, ""), state: "queued", sandbox: "pending", source: null, result: null, error: null, startedAt: performance.now(), elapsed: null });
    });
    $("intake").hidden = true;
    $("results").hidden = false;
    $("inventory").hidden = true;
    $("run-error").hidden = true;
    $("run-toast").hidden = true;
    $("reset-button").hidden = true;
    $("run-title").textContent = sharedText(files.length === 1 ? "readingOne" : "readingRooms", { count: files.length });
    $("run-context").textContent = meta ? contextForMeta(meta) : sharedText("openingRun");
    $("run-progress-bar").style.width = "3%";
    $("queue-text").textContent = sharedText("queueActive", { active: 0, waiting: 0 });
    $("queue-limit").textContent = sharedText("waitingCapacity");
    $("queue-active-bar").style.width = "0%";
    $("fleet-status").textContent = sharedText("roomsReturned", { done: 0, total: files.length });
    updateExportAvailability();
    addLog("plain", `Preparing ${files.length} room ${files.length === 1 ? "photo" : "photos"}.`);
    renderFleet();
    renderLogs();
    requestAnimationFrame(() => $("results").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }

  function contextForMeta(meta) {
    if (meta.sample) return sharedText("contextSample");
    if (meta.daytona_mode === "live") return sharedText("contextLive", { count: meta.parallel_limit });
    return sharedText("contextLocal", { count: meta.parallel_limit });
  }

  function sourceLabel(source) {
    return ({ live: "LIVE", cache: "CACHE", mock: "MOCK" })[source] || "WAIT";
  }

  const TILE_PROGRESS = { queued: 2, creating: 10, sanitizing: 26, detecting: 45, scoring: 65, refining: 82, released: 100, destroyed: 100, error: 100, cleanup_failed: 100 };

  function tileElapsed(tile) {
    return tile.elapsed !== null && Number.isFinite(Number(tile.elapsed)) ? Math.max(0, Number(tile.elapsed)) : Math.max(0, (performance.now() - tile.startedAt) / 1000);
  }

  function updateFleetClocks() {
    if (!state.running) return;
    document.querySelectorAll("#fleet .fleet-tile").forEach((card) => {
      const tile = state.tiles.get(Number(card.id.replace("fleet-room-", "")) - 1);
      if (!tile) return;
      const clock = card.querySelector(".tile-elapsed");
      if (clock) clock.textContent = `${tileElapsed(tile).toFixed(tileElapsed(tile) < 10 ? 1 : 0)}${sharedText("secondsShort")}`;
    });
  }

  function renderFleet() {
    const fleet = clear($("fleet"));
    [...state.tiles.values()].sort((a, b) => a.index - b.index).forEach((tile) => {
      const working = !["released", "destroyed", "cleanup_failed", "error", "queued"].includes(tile.state);
      const complete = Boolean(tile.result) || tile.state === "released" || tile.state === "destroyed";
      const failed = tile.state === "error" || tile.state === "cleanup_failed";
      const card = el("article", `fleet-tile${working ? " is-working" : ""}${complete && !failed ? " is-complete" : ""}${failed ? " is-failed" : ""}`);
      card.id = `fleet-room-${tile.index + 1}`;
      card.dataset.state = tile.state;
      const top = el("div", "tile-top");
      top.append(el("span", "room-number", sharedText("roomNumber", { number: String(tile.index + 1).padStart(2, "0") })), el("span", "fleet-state", sharedText(tile.state === "destroyed" ? "destroyedLabel" : tile.state === "error" ? "errorState" : tile.state)));
      card.append(top, el("div", "fleet-room-name", tile.result?.name || tile.name));
      if (tile.result && photoUrl(tile.result.image)) {
        const imageBox = el("div", "fleet-photo");
        const image = el("img");
        image.src = photoUrl(tile.result.image);
        image.alt = "";
        image.loading = "lazy";
        imageBox.append(image);
        card.append(imageBox);
      } else {
        const placeholder = el("div", "fleet-placeholder");
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.append(svgEl("svg", { viewBox: "0 0 28 28" }));
        const icon = placeholder.firstChild;
        icon.append(svgEl("path", { d: "M4 10V4h6m8 0h6v6m0 8v6h-6m-8 0H4v-6M9 15h10M14 10v9", fill: "none", stroke: "currentColor" }));
        card.append(placeholder);
      }
      const meta = el("div", "tile-meta");
      const worker = tile.sandbox && tile.sandbox !== "pending" ? tile.sandbox : sharedText("pending");
      meta.append(el("span", "", worker), el("span", "source-badge", sourceLabel(tile.source)));
      meta.lastChild.dataset.source = tile.source || "waiting";
      meta.lastChild.title = tile.source ? sharedText("latestSource", { source: tile.source }) : sharedText("noInferenceYet");
      card.append(meta);
      if (tile.error || tile.state === "cleanup_failed") card.append(el("p", "cleanup-warning", tile.state === "cleanup_failed" ? sharedText("cleanupReview") : sharedText("roomProcessingFailed")));
      const timing = el("div", "tile-timing");
      timing.append(el("span", "tile-elapsed", `${tileElapsed(tile).toFixed(tileElapsed(tile) < 10 ? 1 : 0)}${sharedText("secondsShort")}`), el("span", "", sharedText("elapsed")));
      const progress = el("div", "tile-progress");
      const progressValue = Math.max(2, Math.min(100, TILE_PROGRESS[tile.state] ?? 5));
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", sharedText("tileProgress", { name: tile.name }));
      progress.setAttribute("aria-valuenow", String(progressValue));
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      const progressBar = el("span");
      progressBar.style.width = `${progressValue}%`;
      progress.append(progressBar);
      card.append(timing, progress);
      fleet.append(card);
    });
  }

  function renderQueue() {
    const queue = state.queue;
    $("queue-text").textContent = sharedText("queueActive", { active: queue.closed ? 0 : queue.active, waiting: queue.closed ? 0 : queue.waiting });
    $("queue-limit").textContent = queue.closed ? sharedText("queueClosed") : sharedText(queue.limit === 1 ? "queueSlot" : "queueSlots", { count: queue.limit });
    $("queue-active-bar").style.width = `${queue.closed ? 0 : Math.min(100, queue.active / queue.limit * 100)}%`;
    $("gpu-queue").setAttribute("aria-label", sharedText("gpuAria", { active: queue.closed ? 0 : queue.active, waiting: queue.closed ? 0 : queue.waiting, limit: queue.limit }));
  }

  function updateProgress() {
    const total = state.tiles.size || state.files.length || 1;
    const finished = [...state.tiles.values()].filter((tile) => tile.result || tile.error || tile.state === "cleanup_failed").length;
    const completeCount = allRooms().length;
    $("run-progress-bar").style.width = `${state.done ? 100 : Math.max(3, Math.min(96, Math.round(finished / total * 100)))}%`;
    $("fleet-status").textContent = sharedText("roomsReturned", { done: completeCount, total }) + (state.failures ? ` · ${sharedText("roomsFailed", { count: state.failures })}` : "");
  }

  function normaliseRoom(result, index) {
    const previous = state.rooms.get(result.id) || allRooms().find((room) => room.index === index);
    const previousItems = new Map(previous ? previous.items.map((item) => [item.id, item]) : []);
    const items = Array.isArray(result.items) ? result.items : [];
    const room = {
      ...result,
      id: result.id || `room-${index + 1}`,
      index,
      name: String(result.name || sharedText("roomGeneric", { count: index + 1 })),
      room_type: String(result.room_type || "other"),
      items: [],
    };
    room.items = items.filter((raw) => !state.deletedIds.has(raw.id)).map((raw, itemIndex) => {
      const id = String(raw.id || `r${index + 1}-item-${itemIndex + 1}`);
      const prior = previousItems.get(id);
      if (prior?._edited) return prior;
      const box = Array.isArray(raw.box) && raw.box.length === 4 ? raw.box.map((value) => Math.max(0, Math.min(1000, finite(value)))) : [0, 0, 1000, 1000];
      const item = {
        ...raw,
        id,
        index: Math.max(1, Math.trunc(finite(raw.index, itemIndex + 1))),
        label: String(raw.label || sharedText("householdItem")).slice(0, 160),
        category: Object.hasOwn(DEPRECIATION, raw.category) ? raw.category : "other",
        condition: Object.hasOwn(CONDITION_FACTOR, raw.condition) ? raw.condition : "good",
        replacement_usd: Math.max(0, finite(raw.replacement_usd)),
        age_years: Math.min(50, Math.max(0, Math.trunc(finite(raw.age_years, 0)))),
        box,
        risk: ["low", "medium", "high"].includes(raw.risk) ? raw.risk : "low",
        risk_reason: String(raw.risk_reason || ""),
        near_bed_or_exit: Boolean(raw.near_bed_or_exit),
        fix_keys: Array.isArray(raw.fix_keys) ? raw.fix_keys.filter((key) => Object.hasOwn(FIXES, key)) : [],
        verified: Boolean(raw.verified),
        confidence: Math.max(0, Math.min(1, finite(raw.confidence))),
        duplicate_of: raw.duplicate_of || null,
        receipt: Boolean(raw.receipt),
        brand_model: String(raw.brand_model || ""),
      };
      item.acv_usd = acvFor(item);
      return item;
    });
    return room;
  }

  function handleEvent(event) {
    if (!event || typeof event.type !== "string") return;
    const index = Number.isInteger(event.room) ? event.room : null;
    const tile = index !== null ? state.tiles.get(index) : null;
    switch (event.type) {
      case "meta": {
        state.meta = event;
        state.runId = event.run_id;
        $("run-context").textContent = contextForMeta(event);
        $("queue-limit").textContent = sharedText("queueWaiting", { count: event.parallel_limit });
        const mode = event.daytona_mode === "live" ? "Daytona live mode" : "Local worker mode";
        updateEnvironmentText();
        addLog("technical", `Run ${event.run_id} · ${mode} · ${event.nosana_mode} · model ${event.model}`);
        if (event.sample) addLog("plain", "Cached offline demo: six sample rooms use bundled responses, not live cloud inference.");
        break;
      }
      case "state":
        if (tile) {
          tile.state = event.state || tile.state;
          tile.sandbox = event.sandbox || tile.sandbox;
          tile.message = event.message || null;
          if (event.elapsed !== undefined) tile.elapsed = Math.max(0, finite(event.elapsed));
          if (["released", "destroyed", "error", "cleanup_failed"].includes(event.state) && tile.elapsed === null) tile.elapsed = tileElapsed(tile);
          if (event.state === "cleanup_failed") tile.error = "Sandbox deletion needs review";
          if (event.cleanup === "failed" || event.state === "cleanup_failed") state.cleanupFailed = true;
          if (event.state === "released" || event.state === "destroyed") addLog("plain", event.state === "destroyed" ? "Remote sandbox destroyed." : "Local room worker released.", index);
          if (event.message) addLog("technical", event.message, index);
          renderFleet();
          updateProgress();
        }
        break;
      case "queue": {
        const active = Math.max(0, Math.trunc(finite(event.active)));
        const waiting = Math.max(0, Math.trunc(finite(event.waiting)));
        const limit = Math.max(1, Math.trunc(finite(event.limit, 1)));
        state.queue = { active, waiting, limit, closed: false };
        renderQueue();
        break;
      }
      case "inference":
        if (tile) {
          tile.source = ["live", "cache", "mock"].includes(event.source) ? event.source : "mock";
          tile.model = event.model || tile.model;
          renderFleet();
        }
        updateEnvironmentText();
        addLog("technical", `Inference ${event.source || "unknown"} · ${event.model || "model unavailable"}`, index);
        break;
      case "log":
        addLog(event.level === "technical" ? "technical" : "plain", event.message || "", index);
        break;
      case "room": {
        if (index === null || !event.result) break;
        const room = normaliseRoom(event.result, index);
        state.rooms.set(room.id, room);
        if (tile) {
          tile.result = room;
          tile.name = room.name;
          if (tile.state !== "destroyed" && tile.state !== "cleanup_failed") tile.state = "released";
        }
        if (!state.selectedRoom) state.selectedRoom = room.id;
        $("inventory").hidden = false;
        $("run-error").hidden = true;
        renderFleet();
        refreshInventory();
        updateProgress();
        addLog("plain", `${room.name} added ${room.items.length} ${room.items.length === 1 ? "item" : "items"} to the ledger.`, index);
        break;
      }
      case "dedupe": {
        const flags = Array.isArray(event.flags) ? event.flags : [];
        flags.forEach((flag) => {
          const found = findItem(flag.id);
          if (found) {
            found.item.duplicate_of = flag.duplicate_of || null;
            found.item.duplicate_confirmed = false;
          }
        });
        if (flags.length) addLog("plain", `${flags.length} possible ${flags.length === 1 ? "duplicate" : "duplicates"} flagged. Every item remains in the inventory.`);
        refreshInventory();
        break;
      }
      case "error":
        state.failures += 1;
        if (tile) {
          tile.state = "error";
          tile.error = String(event.message || "Room processing failed");
        }
        addLog("plain", "This room could not be processed. Other rooms continue.", index);
        addLog("technical", String(event.message || "Unknown room error"), index);
        renderFleet();
        updateProgress();
        break;
      case "summary":
        state.summary = event;
        addLog("technical", `Summary · ${event.rooms} rooms · ${event.sandboxes} sandboxes · ${event.destroyed} destroyed · ${event.files_retained} uploaded files retained`);
        break;
      case "done":
        finishRun(Boolean(event.ok));
        break;
      default:
        addLog("technical", `Ignored unsupported event type: ${event.type}`, index);
    }
  }

  function finishRun(ok) {
    if (state.done) return;
    state.done = true;
    setBusy(false);
    $("run-title").textContent = allRooms().length ? sharedText("yourEvidenceLedger") : sharedText("runFinished");
    $("run-progress-bar").style.width = "100%";
    state.queue.closed = true;
    renderQueue();
    if (!allRooms().length) {
      $("run-error").hidden = false;
      $("run-error-message").textContent = state.failures ? sharedText(state.failures === 1 ? "failureOne" : "failureCount", { count: state.failures }) : sharedText("noItemsReturned");
    }
    updateProgress();
    updateExportAvailability();
    addLog("plain", ok ? "All room workers have finished." : "The run finished with room errors. Usable room evidence remains available.");
    if (state.summary) showSummaryToast(state.summary, ok);
    else showToast(ok ? "Run complete" : "Run finished with errors", sharedText("roomsItemsTime", { rooms: allRooms().length, count: allRooms().reduce((sum, room) => sum + room.items.length, 0), duration: finite(state.summary?.duration_seconds) }), !ok);
  }

  function failRun(error) {
    state.done = true;
    state.interrupted = true;
    setBusy(false);
    setEnvironment({ text: sharedText("runInterrupted"), status: "error" });
    const message = error instanceof Error ? error.message : sharedText("streamEnded");
    addLog("technical", message);
    addLog("plain", "The run stopped before completion. Any returned rooms can still be edited and exported.");
    $("run-title").textContent = allRooms().length ? sharedText("interruptedTitle") : sharedText("couldNotStart");
    $("run-error").hidden = false;
    $("run-error-message").textContent = sharedText("streamEnded");
    $("run-progress-bar").style.width = "100%";
    $("run-progress-bar").style.background = "var(--hazard)";
    updateExportAvailability();
    showToast("Analysis interrupted", sharedText("streamEnded"), true);
  }

  function showSummaryToast(summary, ok) {
    const rooms = Math.max(0, Math.trunc(finite(summary.rooms)));
    const items = Math.max(0, Math.trunc(finite(summary.items)));
    const retained = Math.max(0, Math.trunc(finite(summary.files_retained)));
    const duration = finite(summary.duration_seconds);
    const workerIds = new Set([...state.tiles.values()].map((tile) => tile.sandbox).filter((id) => id && !["pending", "creating"].includes(id)));
    const workerCount = workerIds.size || state.tiles.size || rooms;
    const local = summary.daytona_mode !== "live";
    let message;
    if (local) {
      message = sharedText("summaryLocal", { rooms, workers: workerCount, items, duration, retained });
    } else {
      const sandboxes = workerCount || Math.max(0, Math.trunc(finite(summary.sandboxes)));
      message = sharedText("summaryLive", { rooms, sandboxes, items, duration, retained });
      const destroyed = Math.max(0, Math.trunc(finite(summary.destroyed)));
      if (destroyed >= sandboxes && sandboxes > 0 && !state.cleanupFailed) message += ` · ${sharedText("allDestroyed")}`;
      else if (state.cleanupFailed || destroyed < sandboxes) message += ` · ${sharedText("cleanupNeedsReview")}`;
    }
    if (summary.failures) message += ` · ${sharedText("failedSuffix", { count: summary.failures })}`;
    const title = !ok ? sharedText("runErrors") : state.meta?.sample ? sharedText("cachedComplete") : local ? sharedText("localComplete") : sharedText("liveComplete");
    showToast(title, message, !ok || state.cleanupFailed);
    state.toast = { kind: "summary", summary, ok };
  }

  function showToast(title, message, warning = false) {
    state.toast = { kind: "custom", title, message, warning };
    $("toast-title").textContent = localizedMessage(title);
    $("toast-message").textContent = localizedMessage(message);
    $("run-toast").classList.toggle("is-warning", warning);
    $("run-toast").querySelector(".toast-mark").textContent = warning ? "!" : "✓";
    $("run-toast").hidden = false;
  }

  async function responseError(response) {
    let message = sharedText("httpStatus", { status: response.status });
    try {
      const body = await response.json();
      if (body.detail) message = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch (_) {
      // Keep the bounded HTTP status message when the response is not JSON.
    }
    return new Error(message);
  }

  async function startAnalysis(files, sample = false, prepared = false) {
    if ((state.running && !prepared) || !files.length) return;
    setBusy(true);
    prepareRun(files);
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    form.append("sample", String(sample));
    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form, headers: { Accept: "text/event-stream" } });
      if (!response.ok) throw await responseError(response);
      addLog("technical", `Analyze stream opened · HTTP ${response.status} · ${files.length} files`);
      const decoder = new TextDecoder();
      let buffer = "";
      const consumeFrame = (frame) => {
        const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n").trim();
        if (!data || data === "[DONE]") return;
        try {
          handleEvent(JSON.parse(data));
        } catch (error) {
          addLog("technical", `Skipped malformed event: ${error instanceof Error ? error.message : "unknown parse error"}`);
        }
      };
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll("\r\n", "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            consumeFrame(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
          }
          if (done) break;
        }
      } else {
        buffer = await response.text();
      }
      if (buffer.trim()) buffer.split(/\r?\n\r?\n/).forEach(consumeFrame);
      if (!state.done) finishRun(state.failures === 0);
    } catch (error) {
      failRun(error);
    }
  }

  async function runSample() {
    if (state.running) return;
    setBusy(true);
    showUploadError("");
    try {
      const response = await fetch("/api/samples", { headers: { Accept: "application/json" } });
      if (!response.ok) throw await responseError(response);
      const payload = await response.json();
      const samples = Array.isArray(payload.samples) ? payload.samples : [];
      if (!samples.length) throw new Error(sharedText("noSamples"));
      const files = await Promise.all(samples.map(async (sample, index) => {
        const imageResponse = await fetch(sample.url);
        if (!imageResponse.ok) throw new Error(sharedText("sampleLoadError", { count: index + 1 }));
        const blob = await imageResponse.blob();
        const safeName = String(sample.name || sharedText("roomGeneric", { count: index + 1 })).replace(/[\\/]/g, "-").slice(0, 80);
        return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
      }));
      await startAnalysis(files, true, true);
    } catch (error) {
      setBusy(false);
      addLog("technical", error instanceof Error ? error.message : "sample load failed");
      showUploadError("sampleGenericError");
    }
  }

  function refreshInventory() {
    const rooms = allRooms();
    if (!rooms.length) {
      updateExportAvailability();
      return;
    }
    if (!rooms.some((room) => room.id === state.selectedRoom)) state.selectedRoom = rooms[0].id;
    if (state.selectedItem && !findItem(state.selectedItem)) state.selectedItem = null;
    updateStats();
    renderRoomList();
    renderActiveRoom();
    renderQuakePanel();
    renderInspector();
    updateExportAvailability();
  }

  function updateStats() {
    const rooms = allRooms();
    const items = rooms.flatMap((room) => room.items);
    const replacement = items.reduce((sum, item) => sum + finite(item.replacement_usd), 0);
    const acv = items.reduce((sum, item) => sum + acvFor(item), 0);
    $("total-value").textContent = money0.format(replacement);
    $("acv-value").textContent = money0.format(acv);
    $("item-count").textContent = String(items.length);
    $("room-count").textContent = String(rooms.length);
  }

  function renderRoomList() {
    const list = clear($("room-list"));
    allRooms().forEach((room) => {
      const button = el("button", "room-tab");
      button.type = "button";
      button.dataset.roomId = room.id;
      button.dataset.number = String(room.index + 1).padStart(2, "0");
      button.setAttribute("aria-current", String(room.id === state.selectedRoom));
      button.setAttribute("aria-label", `${room.name}, ${localizedItemCount(room.items.length)}`);
      button.append(el("strong", "", room.name), el("small", "", `${localizedItemCount(room.items.length)} · ${money0.format(room.items.reduce((sum, item) => sum + item.replacement_usd, 0))}`));
      list.append(button);
    });
  }

  function sleepingPriority(room, item) {
    return room.room_type === "bedroom" && item.near_bed_or_exit && ["medium", "high"].includes(item.risk);
  }

  function sortedItems(room) {
    return [...room.items].sort((a, b) => {
      if (state.mode === "quake") {
        const priority = Number(sleepingPriority(room, b)) - Number(sleepingPriority(room, a));
        if (priority) return priority;
        const weights = { high: 0, medium: 1, low: 2 };
        const risk = weights[a.risk] - weights[b.risk];
        if (risk) return risk;
      }
      return a.index - b.index;
    });
  }

  function activeRoom() {
    return state.rooms.get(state.selectedRoom) || allRooms()[0] || null;
  }

  function renderActiveRoom() {
    const room = activeRoom();
    if (!room) return;
    $("active-room-name").textContent = room.name;
    const readableType = roomTypeLabel(room);
    const high = room.items.filter((item) => item.risk === "high").length;
    $("active-room-meta").textContent = `${readableType} · ${room.width || "?"} × ${room.height || "?"} · ${localizedItemCount(room.items.length)}`;
    $("active-room-risk").hidden = state.mode !== "quake" || !high;
    $("active-room-risk").textContent = state.language === "ja" ? JA.roomHazards.replace("{count}", high) : `${high} high-risk ${high === 1 ? "item" : "items"}`;
    $("active-room-risk").setAttribute("aria-label", $("active-room-risk").textContent);
    const canvas = clear($("photo-canvas"));
    const image = el("img");
    const url = photoUrl(room.image);
    if (url) image.src = url;
    image.alt = sharedText("photoAria", { room: room.name });
    image.id = `room-image-${room.index + 1}`;
    canvas.append(image);
    const overlay = svgEl("svg", {
      class: "box-overlay", viewBox: "0 0 1000 1000", preserveAspectRatio: "none",
      role: "group", "aria-label": sharedText("boxesAria", { room: room.name }),
    });
    overlay.id = "box-overlay";
    room.items.forEach((item) => {
      const [x0, y0, x1, y1] = item.box;
      const group = svgEl("g", {
        class: `box-target${item.id === state.selectedItem ? " is-selected" : ""}`,
        tabindex: "0", role: "button", "data-item-id": item.id, "data-risk": item.risk,
        "aria-label": sharedText("itemAria", { number: item.index, label: item.label }), "aria-pressed": String(item.id === state.selectedItem),
      });
      const width = Math.max(1, x1 - x0);
      const height = Math.max(1, y1 - y0);
      group.append(svgEl("title", {}, `${item.index}. ${item.label}`));
      group.append(svgEl("rect", { class: "detection-box", x: x0, y: y0, width, height }));
      const plateX = Math.min(948, Math.max(0, x0));
      const plateY = Math.min(955, Math.max(0, y0));
      group.append(svgEl("rect", { class: "number-plate", x: plateX, y: plateY, width: 52, height: 45 }));
      group.append(svgEl("text", { class: "box-number", x: plateX + 26, y: plateY + 24 }, item.index));
      overlay.append(group);
    });
    canvas.append(overlay);
    const caption = clear($("photo-caption"));
    caption.append(el("span", "", sharedText("hashLabel", { hash: `${String(room.sha256 || sharedText("unavailableLower")).slice(0, 16)}${room.sha256 ? "…" : ""}` })), el("span", "", sharedText(room.metadata_removed ? "metadataRemoved" : "sanitizedEvidence")));
    $("legend-title").textContent = sharedText("numberedInventory");
    $("legend-count").textContent = localizedItemCount(room.items.length);
    renderLegend(room);
  }

  function renderLegend(room) {
    const legend = clear($("item-legend"));
    if (!room.items.length) {
      legend.append(el("p", "item-empty", sharedText("noItemsRoom")));
      return;
    }
    sortedItems(room).forEach((item) => {
      const button = el("button", `item-row${item.id === state.selectedItem ? " is-selected" : ""}`);
      button.type = "button";
      button.dataset.itemId = item.id;
      button.setAttribute("aria-pressed", String(item.id === state.selectedItem));
      button.append(el("span", "item-index", item.index));
      const main = el("span", "item-main");
      main.append(el("strong", "", item.label));
      const detail = el("small");
      if (state.mode === "quake") {
        const dot = el("span", `risk-dot ${item.risk}`);
        dot.setAttribute("aria-hidden", "true");
        detail.append(dot, document.createTextNode(sleepingPriority(room, item) ? `${riskLabel(item.risk)} · ${t("sleepingShort")}` : `${riskLabel(item.risk)} · ${categoryText(item.category)}`));
      } else {
        const details = [categoryText(item.category), conditionText(item.condition)];
        if (item.duplicate_of) details.push(sharedText("possibleDuplicateShort"));
        detail.textContent = details.join(" · ");
      }
      main.append(detail);
      button.append(main, el("span", "item-price", money0.format(item.replacement_usd)));
      legend.append(button);
    });
  }

  function readinessScore() {
    const rooms = allRooms();
    if (!rooms.length) return 100;
    let penalty = 0;
    rooms.forEach((room) => {
      const multiplier = room.room_type === "bedroom" ? 1.5 : 1;
      room.items.forEach((item) => {
        penalty += (item.risk === "high" ? 8 : item.risk === "medium" ? 3 : 0) * multiplier;
      });
    });
    return Math.max(0, Math.min(100, Math.round(100 - penalty / Math.sqrt(rooms.length))));
  }

  function shoppingList() {
    const quantities = new Map();
    allRooms().forEach((room) => room.items.forEach((item) => {
      if (item.risk === "low") return;
      item.fix_keys.forEach((key) => {
        if (FIXES[key]) quantities.set(key, (quantities.get(key) || 0) + 1);
      });
    }));
    return [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, quantity]) => ({ key, quantity, total: FIXES[key].unit * quantity }));
  }

  function renderQuakePanel() {
    const score = readinessScore();
    $("readiness-score").textContent = String(score);
    $("readiness-meter").setAttribute("aria-valuenow", String(score));
    $("readiness-meter").setAttribute("aria-valuetext", `${score} / 100`);
    $("readiness-ring").style.strokeDashoffset = String(100 - score);
    $("readiness-ring").style.stroke = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("quake-title").textContent = t("readiness");
    $("readiness-summary").textContent = t("readinessSummary");
    const band = score >= 80 ? t("readinessGood") : score >= 55 ? t("readinessFair") : t("readinessLow");
    $("readiness-band").textContent = band;
    $("readiness-band").style.borderColor = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("readiness-band").style.color = score >= 80 ? "var(--safe)" : score >= 55 ? "var(--gold)" : "var(--hazard)";
    $("shopping-title").textContent = t("shopping");
    const list = shoppingList();
    const total = list.reduce((sum, row) => sum + row.total, 0);
    $("shopping-total").textContent = `${yen.format(total)} ${t("estimated")}`;
    const container = clear($("shopping-list"));
    if (!list.length) {
      container.append(el("p", "quake-empty", t("noFixes")));
      return;
    }
    list.forEach((row) => {
      const line = el("div", "shopping-row");
      line.append(el("span", "shopping-quantity", `× ${row.quantity}`), el("span", "shopping-product", fixName(row.key)), el("span", "shopping-price", yen.format(row.total)));
      container.append(line);
    });
  }

  function definitionList(entries) {
    const list = el("dl", "evidence-dl");
    entries.forEach(([label, value, className]) => {
      const row = el("div");
      row.append(el("dt", "", label), el("dd", className || "", value));
      list.append(row);
    });
    return list;
  }

  function renderInspector() {
    const inspector = clear($("inspector"));
    const found = state.selectedItem ? findItem(state.selectedItem) : null;
    if (!found) {
      const empty = el("div", "inspector-empty");
      const icon = svgEl("svg", { viewBox: "0 0 48 48", "aria-hidden": "true" });
      icon.append(svgEl("path", { d: "M7 17V7h10M31 7h10v10M41 31v10H31M17 41H7V31M17 25h14M24 18v14", fill: "none", stroke: "currentColor" }));
      empty.append(icon, el("h3", "", sharedText("inspectEvidence")), el("p", "", sharedText("inspectHint")));
      inspector.append(empty);
      return;
    }
    const { room, item } = found;
    const content = el("div", "inspector-content");
    const top = el("div", "inspector-topline");
    top.append(el("span", "inspector-id", item.id));
    if (item.verified) top.append(el("span", "verified-label", sharedText("verified")));
    content.append(top);
    const cropBox = el("div", "inspector-crop");
    const crop = photoUrl(item.crop);
    if (crop) {
      const image = el("img");
      image.src = crop;
      image.alt = sharedText("evidenceCropAlt", { label: item.label });
      cropBox.append(image);
    } else cropBox.append(el("span", "", sharedText("evidenceCropUnavailable")));
    content.append(cropBox);
    const titleRow = el("div", "inspector-title-row");
    const titleGroup = el("div");
    titleGroup.append(el("h3", "", item.label), el("span", "inspector-category", categoryText(item.category)));
    titleRow.append(titleGroup, el("span", `risk-chip ${item.risk}`, riskLabel(item.risk)));
    content.append(titleRow);
    if (state.mode === "quake" && sleepingPriority(room, item)) content.append(el("div", "sleeping-badge", t("sleeping")));
    const prices = el("div", "price-pair");
    const replacement = el("div");
    replacement.append(el("span", "", sharedText("replacement")), el("strong", "", money2.format(item.replacement_usd)));
    const acv = el("div");
    acv.append(el("span", "", sharedText("actualCash")), el("strong", "", money2.format(acvFor(item))));
    prices.append(replacement, acv);
    content.append(prices);
    if (item.price_flag) {
      const warning = el("p", "price-warning", sharedText("priceAdjusted"));
      warning.title = sharedText("priceFlagHint");
      content.append(warning);
    }
    content.append(definitionList([
      [sharedText("condition"), conditionText(item.condition)],
      [sharedText("estimatedAge"), sharedText(item.age_years === 1 ? "yearValue" : "yearsValue", { count: item.age_years })],
      [sharedText("confidence"), `${Math.round(item.confidence * 100)}%`],
      [sharedText("brandModel"), item.brand_model || sharedText("notIdentified")],
      [sharedText("receipt"), item.receipt ? sharedText("availableCheck") : sharedText("notMarked")],
      [sharedText("boxCoordinates"), item.box.map((value) => Math.round(value)).join(", ")],
    ]));
    if (state.mode === "quake") {
      const reason = el("div", "quake-reason");
      reason.append(el("strong", "", t("reasonTitle")), document.createTextNode(localizedRiskReason(item)));
      if (item.fix_keys.length) reason.append(el("div", "fix-tags", `${t("recommendedFix")}: ${item.fix_keys.map(fixName).join(" · ")}`));
      content.append(reason);
    }
    if (item.duplicate_of && !item.duplicate_dismissed && !item.duplicate_confirmed) {
      const duplicate = el("div", "duplicate-panel");
      duplicate.append(el("strong", "", sharedText("possibleDuplicate")), el("p", "", sharedText("duplicateExplanation", { id: item.duplicate_of })));
      const actions = el("div", "duplicate-actions");
      const confirm = el("button", "text-button", sharedText("confirmDuplicate"));
      confirm.type = "button";
      confirm.dataset.duplicateAction = "confirm";
      confirm.dataset.itemId = item.id;
      const dismiss = el("button", "text-button", sharedText("dismissFlag"));
      dismiss.type = "button";
      dismiss.dataset.duplicateAction = "dismiss";
      dismiss.dataset.itemId = item.id;
      actions.append(confirm, dismiss);
      duplicate.append(actions);
      content.append(duplicate);
    } else if (item.duplicate_confirmed) {
      const resolution = el("div", "duplicate-resolution", sharedText("confirmedDuplicate", { id: item.duplicate_of }));
      const undo = el("button", "text-button", sharedText("undoConfirmation"));
      undo.type = "button";
      undo.dataset.duplicateAction = "undo";
      undo.dataset.itemId = item.id;
      resolution.append(document.createElement("br"), undo);
      content.append(resolution);
    } else if (item.duplicate_dismissed) {
      content.append(el("div", "duplicate-resolution", sharedText("dismissedDuplicate")));
    }
    const actions = el("div", "inspector-actions");
    const edit = el("button", "button button-gold", sharedText("editItem"));
    edit.type = "button";
    edit.id = "edit-item-button";
    edit.dataset.itemId = item.id;
    const fingerprint = definitionList([[sharedText("roomFingerprint"), String(room.sha256 || sharedText("unavailable")), "fingerprint"]]);
    actions.append(edit);
    content.append(actions, fingerprint);
    inspector.append(content);
  }

  function selectItem(id) {
    const found = findItem(id);
    if (!found) return;
    const roomChanged = state.selectedRoom !== found.room.id;
    state.selectedRoom = found.room.id;
    state.selectedItem = id;
    if (roomChanged) {
      renderRoomList();
      renderActiveRoom();
    } else {
      document.querySelectorAll("[data-item-id]").forEach((node) => {
        const selected = node.dataset.itemId === id;
        node.classList.toggle("is-selected", selected);
        if (node.matches("button, g")) node.setAttribute("aria-pressed", String(selected));
      });
    }
    renderInspector();
  }

  function setMode(mode) {
    if (!["insurance", "quake"].includes(mode)) return;
    state.mode = mode;
    document.body.dataset.mode = mode;
    $("mode-insurance").setAttribute("aria-pressed", String(mode === "insurance"));
    $("mode-quake").setAttribute("aria-pressed", String(mode === "quake"));
    $("quake-panel").hidden = mode !== "quake";
    $("quake-panel").lang = mode === "quake" ? state.language : "en";
    if (activeRoom()) {
      renderRoomList();
      renderActiveRoom();
      renderQuakePanel();
      renderInspector();
    }
  }

  function refreshLanguageState() {
    updateEnvironmentText();
    if (state.meta) {
      $("run-context").textContent = contextForMeta(state.meta);
      $("run-title").textContent = state.interrupted ? sharedText("interruptedTitle") : state.done && !allRooms().length ? sharedText("runFinished") : state.done ? sharedText("yourEvidenceLedger") : sharedText(state.files.length === 1 ? "readingOne" : "readingRooms", { count: state.files.length });
      if (!$("run-error").hidden) $("run-error-message").textContent = state.interrupted ? sharedText("streamEnded") : state.failures ? sharedText(state.failures === 1 ? "failureOne" : "failureCount", { count: state.failures }) : sharedText("noItemsReturned");
    }
    renderQueue();
    renderFleet();
    updateProgress();
    renderLogs();
    if (activeRoom()) refreshInventory();
    if (state.uploadError) showUploadError(state.uploadError.key, state.uploadError.params);
    if (state.toast?.kind === "summary") showSummaryToast(state.toast.summary, state.toast.ok);
    else if (state.toast?.kind === "custom") showToast(state.toast.title, state.toast.message, state.toast.warning);
    if ($("item-dialog").open) {
      const found = findItem($("edit-item-id").value);
      if (found) $("item-dialog-title").textContent = sharedText("editItemNumber", { number: found.item.index });
      if (!$("edit-error").hidden) $("edit-error").textContent = sharedText("invalidEdit");
    }
    if ($("delete-dialog").open) {
      const found = findItem($("edit-item-id").value);
      if (found) $("delete-confirmation-copy").textContent = sharedText("deleteNamed", { label: found.item.label, number: found.item.index });
    }
  }

  function toggleLanguage() {
    state.language = state.language === "en" ? "ja" : "en";
    document.documentElement.lang = state.language;
    document.documentElement.dataset.language = state.language;
    try { localStorage.setItem("roomledger-language", state.language); } catch (_) { /* Language still works without storage. */ }
    $("language-label").textContent = state.language === "ja" ? "EN" : "日本語";
    $("language-toggle").setAttribute("aria-label", sharedText(state.language === "ja" ? "switchEnglish" : "switchJapanese"));
    $("quake-panel").lang = state.language;
    translateSharedUI();
    refreshLanguageState();
  }

  function openEditor(id) {
    const found = findItem(id);
    if (!found) return;
    const { item } = found;
    $("edit-item-id").value = item.id;
    $("edit-label").value = item.label;
    $("edit-price").value = String(item.replacement_usd);
    $("edit-condition").value = item.condition;
    $("edit-receipt").checked = Boolean(item.receipt);
    $("edit-error").hidden = true;
    $("item-dialog-title").textContent = sharedText("editItemNumber", { number: item.index });
    updateAcvPreview();
    $("item-dialog").showModal();
    requestAnimationFrame(() => $("edit-label").focus());
  }

  function updateAcvPreview() {
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    const preview = { ...found.item, replacement_usd: Math.max(0, finite($("edit-price").value)), condition: $("edit-condition").value };
    $("edit-acv-preview").textContent = money2.format(acvFor(preview));
  }

  function saveEdit(event) {
    event.preventDefault();
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    const label = $("edit-label").value.trim();
    const price = Number($("edit-price").value);
    if (!label || !Number.isFinite(price) || price < 0 || price > 1000000) {
      $("edit-error").textContent = sharedText("invalidEdit");
      $("edit-error").hidden = false;
      return;
    }
    found.item.label = label.slice(0, 160);
    found.item.replacement_usd = Math.round(price * 100) / 100;
    found.item.condition = $("edit-condition").value;
    found.item.receipt = $("edit-receipt").checked;
    found.item.acv_usd = acvFor(found.item);
    found.item.price_flag = null;
    found.item._edited = true;
    $("item-dialog").close();
    refreshInventory();
    requestAnimationFrame(() => $("edit-item-button")?.focus({ preventScroll: true }));
  }

  function askDelete() {
    const found = findItem($("edit-item-id").value);
    if (!found) return;
    $("delete-confirmation-copy").textContent = sharedText("deleteNamed", { label: found.item.label, number: found.item.index });
    $("item-dialog").close();
    $("delete-dialog").showModal();
  }

  function deleteItem(event) {
    event.preventDefault();
    const id = $("edit-item-id").value;
    const found = findItem(id);
    if (!found) return;
    found.room.items = found.room.items.filter((item) => item.id !== id);
    state.deletedIds.add(id);
    state.selectedItem = null;
    $("delete-dialog").close();
    refreshInventory();
    requestAnimationFrame(() => document.querySelector('.room-tab[aria-current="true"]')?.focus({ preventScroll: true }));
  }

  function resolveDuplicate(id, action) {
    const found = findItem(id);
    if (!found) return;
    if (action === "confirm") {
      found.item.duplicate_confirmed = true;
      found.item.duplicate_dismissed = false;
    } else if (action === "dismiss") {
      found.item.duplicate_dismissed = true;
      found.item.duplicate_confirmed = false;
    } else {
      found.item.duplicate_confirmed = false;
      found.item.duplicate_dismissed = false;
    }
    found.item._edited = true;
    refreshInventory();
  }

  function csvCell(value) {
    let text = String(value ?? "").replaceAll("\0", "");
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const rows = [["room", "item", "category", "condition", "replacement", "ACV", "verified", "receipt", "fingerprint"]];
    allRooms().forEach((room) => [...room.items].sort((a, b) => a.index - b.index).forEach((item) => {
      rows.push([
        room.name, item.label, item.category, item.condition,
        finite(item.replacement_usd).toFixed(2), acvFor(item).toFixed(2),
        item.verified ? "true" : "false", item.receipt ? "true" : "false", room.sha256 || "",
      ]);
    }));
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roomledger-inventory.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function reportBoxes(room) {
    return room.items.map((item) => {
      const [x0, y0, x1, y1] = item.box.map((value) => Math.max(0, Math.min(1000, finite(value))));
      const color = item.risk === "high" ? "#d95845" : item.risk === "medium" ? "#a97812" : "#207d70";
      const plateX = Math.min(948, Math.max(0, x0));
      const plateY = Math.min(955, Math.max(0, y0));
      return `<g><title>${escapeHtml(`${item.index}. ${item.label}`)}</title><rect x="${x0}" y="${y0}" width="${Math.max(1, x1 - x0)}" height="${Math.max(1, y1 - y0)}" fill="${color}18" stroke="${color}" stroke-width="5" vector-effect="non-scaling-stroke"/><rect x="${plateX}" y="${plateY}" width="52" height="45" fill="${color}"/><text x="${plateX + 26}" y="${plateY + 24}" fill="white" font-family="Arial,sans-serif" font-size="25" font-weight="700" text-anchor="middle" dominant-baseline="central">${item.index}</text></g>`;
    }).join("");
  }

  function buildReport() {
    const rooms = allRooms();
    const items = rooms.flatMap((room) => room.items.map((item) => ({ room, item })));
    const replacement = items.reduce((sum, entry) => sum + entry.item.replacement_usd, 0);
    const acv = items.reduce((sum, entry) => sum + acvFor(entry.item), 0);
    const score = readinessScore();
    const shopping = shoppingList();
    const shoppingTotal = shopping.reduce((sum, row) => sum + row.total, 0);
    const disclaimer = state.language === "ja" ? `${sharedText("disclaimer")}（${sharedText("disclaimerEnglish")}）` : sharedText("disclaimerEnglish");
    const date = new Date().toLocaleDateString(state.language === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    const styles = `
      :root{color:#172131;background:#fff;font-family:Arial,"Noto Sans","Yu Gothic",sans-serif;line-height:1.45}*{box-sizing:border-box}body{margin:0;color:#172131}main{max-width:1000px;margin:auto;padding:46px}h1,h2,h3{font-family:Georgia,"Yu Mincho",serif;font-weight:400}h1{font-size:46px;line-height:1.08;margin:10px 0 18px}h2{font-size:27px;margin:35px 0 12px;border-bottom:2px solid #172131;padding-bottom:8px}h3{font-size:19px;margin:22px 0 8px}.brand{font-size:22px}.brand b{color:#9a731b}.lead{color:#49586a;max-width:650px}.cover{min-height:80vh;display:flex;flex-direction:column;justify-content:center}.totals{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #a9b1ba;border-bottom:1px solid #a9b1ba;margin:28px 0}.totals div{padding:16px 12px;border-right:1px solid #d7dce1}.totals div:last-child{border:0}.totals span{display:block;color:#5a6877;font-size:11px}.totals strong{display:block;font-family:Georgia,serif;font-weight:400;font-size:26px}.readiness{font-size:20px;padding:16px;border-left:5px solid ${score >= 80 ? "#207d70" : score >= 55 ? "#a97812" : "#d95845"};background:#f4f5f6}.disclaimer{margin-top:26px;padding:14px;border:1px solid #a97812;color:#674e14;font-weight:700}.meta{color:#5a6877;font-size:12px}.room-break{page-break-before:always}.room-photo{position:relative;margin:14px 0;background:#eee}.room-photo img{display:block;width:100%;height:auto}.room-photo svg{position:absolute;inset:0;width:100%;height:100%}.room-meta{display:flex;justify-content:space-between;gap:15px;color:#5a6877;font-size:11px}table{border-collapse:collapse;width:100%;font-size:11px}th{text-align:left;color:#49586a;background:#eef0f2}th,td{padding:8px;border:1px solid #ccd2d8;vertical-align:top;overflow-wrap:anywhere}td.num,th.num{text-align:right;white-space:nowrap}.crop{width:85px;height:65px;object-fit:cover}.legend{padding:0;list-style:none;font-size:12px}.legend li{display:grid;grid-template-columns:34px 1fr auto;gap:10px;padding:7px 0;border-bottom:1px solid #e0e3e6}.number{font-family:monospace;color:#795d19}.high{color:#ac3c2c;font-weight:bold}.medium{color:#795d19}.sleeping{display:inline-block;background:#fae6e2;color:#9a2f21;padding:3px 6px;font-weight:bold}.shopping{width:100%;font-size:13px}.method{font-size:12px;color:#49586a}.fingerprints{font-family:monospace;font-size:10px;word-break:break-all}.print-button{position:fixed;right:20px;top:20px;padding:12px 18px;border:0;background:#172131;color:white;font-weight:bold;cursor:pointer}footer{margin-top:40px;padding-top:15px;border-top:1px solid #a9b1ba;font-size:12px}.footnote{font-size:10px;color:#5a6877}@page{size:A4;margin:15mm}@media print{main{max-width:none;padding:0}.print-button{display:none}.cover{min-height:245mm}h2,.room-photo,tr{break-inside:avoid}thead{display:table-header-group}.room-break{page-break-before:always}}@media(max-width:600px){main{padding:25px 16px}.totals{grid-template-columns:1fr 1fr}.totals div:nth-child(2){border-right:0}.inventory-table{font-size:9px}.crop{width:55px;height:45px}.hide-mobile{display:none}}`;
    const inventoryRows = items.map(({ room, item }) => `<tr><td>${photoUrl(item.crop) ? `<img class="crop" src="${escapeHtml(photoUrl(item.crop))}" alt="">` : ""}</td><td>${escapeHtml(room.name)}<br><span class="footnote">${escapeHtml(item.id)}</span></td><td><strong>${item.index}. ${escapeHtml(item.label)}</strong><br>${escapeHtml(item.brand_model || "—")}</td><td>${escapeHtml(categoryText(item.category))}</td><td>${escapeHtml(conditionText(item.condition))}<br>${escapeHtml(sharedText(item.age_years === 1 ? "yearValue" : "yearsValue", { count: item.age_years }))}</td><td class="num">${escapeHtml(money2.format(item.replacement_usd))}</td><td class="num">${escapeHtml(money2.format(acvFor(item)))}</td><td>${item.verified ? "✓" : "—"} / ${item.receipt ? "✓" : "—"}</td></tr>`).join("");
    const inventory = `<section class="room-break"><h2>${escapeHtml(sharedText("reportInventory"))}</h2><p class="meta">${escapeHtml(sharedText("reportInventoryNote"))}</p><table class="inventory-table"><thead><tr><th>${escapeHtml(sharedText("reportCrop"))}</th><th>${escapeHtml(sharedText("reportRoomId"))}</th><th>${escapeHtml(sharedText("reportItemBrand"))}</th><th>${escapeHtml(sharedText("reportCategory"))}</th><th>${escapeHtml(sharedText("reportConditionAge"))}</th><th class="num">${escapeHtml(sharedText("replacement"))}</th><th class="num">ACV</th><th>${escapeHtml(sharedText("reportVerifiedReceipt"))}</th></tr></thead><tbody>${inventoryRows || `<tr><td colspan="8">${escapeHtml(sharedText("noItemsInventory"))}</td></tr>`}</tbody></table></section>`;
    const roomSections = rooms.map((room) => {
      const url = photoUrl(room.image);
      const legend = [...room.items].sort((a, b) => a.index - b.index).map((item) => `<li><span class="number">${item.index}</span><span><strong>${escapeHtml(item.label)}</strong> <span class="${item.risk}">${escapeHtml(riskLabel(item.risk))}</span>${sleepingPriority(room, item) ? `<br><span class="sleeping">${escapeHtml(t("sleeping"))}</span>` : ""}${item.fix_keys.length && item.risk !== "low" ? `<br><span class="footnote">${escapeHtml(t("recommendedFix"))}: ${escapeHtml(item.fix_keys.map(fixName).join(" · "))}</span>` : ""}</span><span>${escapeHtml(money0.format(item.replacement_usd))}</span></li>`).join("");
      return `<section class="room-break"><h2>${room.index + 1}. ${escapeHtml(room.name)}</h2><div class="room-meta"><span>${escapeHtml(roomTypeLabel(room))} · ${escapeHtml(localizedItemCount(room.items.length))} · ${room.width} × ${room.height}</span><span>${escapeHtml(sharedText(room.metadata_removed ? "gpsMetadataRemoved" : "sanitizedJpeg"))}</span></div><div class="room-photo">${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(sharedText("photoEvidenceAlt", { room: room.name }))}">` : ""}<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="${escapeHtml(sharedText("numberedBoxes"))}">${reportBoxes(room)}</svg></div><p class="fingerprints"><strong>${escapeHtml(sharedText("photoEvidenceFingerprint"))}</strong><br>SHA-256 ${escapeHtml(room.sha256 || sharedText("unavailable"))}<br>${escapeHtml(room.captured_at || sharedText("timestampUnavailable"))}</p><ul class="legend">${legend || `<li>${escapeHtml(sharedText("noItemsRoom"))}</li>`}</ul></section>`;
    }).join("");
    const fixes = shopping.length ? `<table class="shopping"><thead><tr><th>${escapeHtml(state.language === "ja" ? JA.quantity : "Quantity")}</th><th>${escapeHtml(sharedText("product"))}</th><th class="num">${escapeHtml(sharedText("estimatedJpy"))}</th></tr></thead><tbody>${shopping.map((row) => `<tr><td>× ${row.quantity}</td><td>${escapeHtml(fixName(row.key))}</td><td class="num">${escapeHtml(yen.format(row.total))}</td></tr>`).join("")}</tbody></table><p><strong>${escapeHtml(yen.format(shoppingTotal))}</strong> ${escapeHtml(t("estimated"))}</p>` : `<p>${escapeHtml(t("noFixes"))}</p>`;
    const depreciation = Object.entries(DEPRECIATION).map(([category, rate]) => `<tr><td>${escapeHtml(categoryText(category))}</td><td>${Math.round(rate * 100)}${escapeHtml(sharedText("perYear"))}</td></tr>`).join("");
    const evidenceRows = rooms.map((room) => `<tr><th scope="row">${escapeHtml(room.name)}</th><td class="fingerprints">${escapeHtml(room.sha256 || sharedText("unavailable"))}</td><td>${escapeHtml(room.captured_at || sharedText("unavailable"))}</td></tr>`).join("");
    return `<!doctype html><html lang="${state.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(sharedText("reportTitle"))}</title><style>${styles}</style></head><body><button class="print-button" id="print-report" type="button">${escapeHtml(sharedText("printSavePdf"))}</button><main><section class="cover"><div class="brand">Room<b>Ledger</b></div><h1>${escapeHtml(sharedText("reportCoverTitleA"))}<br>${escapeHtml(sharedText("reportCoverTitleB"))}</h1><p class="lead">${escapeHtml(sharedText("reportLead"))}</p><p class="meta">${escapeHtml(sharedText("prepared", { date }))}${state.runId ? ` · ${escapeHtml(sharedText("runLabel", { id: state.runId }))}` : ""}</p><div class="totals"><div><span>${escapeHtml(sharedText("replacement"))}</span><strong>${escapeHtml(money0.format(replacement))}</strong></div><div><span>${escapeHtml(sharedText("actualCashValue"))}</span><strong>${escapeHtml(money0.format(acv))}</strong></div><div><span>${escapeHtml(sharedText("itemsLabel"))}</span><strong>${items.length}</strong></div><div><span>${escapeHtml(sharedText("roomsLabel"))}</span><strong>${rooms.length}</strong></div></div><div class="readiness">${escapeHtml(t("readiness"))}: ${score} / 100<br><small>${escapeHtml(t("readinessSummary"))}</small></div><p class="disclaimer">${disclaimer}</p></section>${inventory}${roomSections}<section class="room-break"><h2>${escapeHtml(t("shopping"))}</h2><p>${escapeHtml(sharedText("shoppingExplanation"))}</p>${fixes}<h2>${escapeHtml(sharedText("appendixTitle"))}</h2><div class="method"><p>${escapeHtml(sharedText("methodImage"))}</p><p>${escapeHtml(sharedText("methodAcv"))}</p><table><thead><tr><th>${escapeHtml(sharedText("reportCategory"))}</th><th>${escapeHtml(sharedText("annualDepreciation"))}</th></tr></thead><tbody>${depreciation}</tbody></table><p>${escapeHtml(sharedText("readinessFormula"))}</p><p>${escapeHtml(sharedText("methodDedupe"))}</p></div><h3>${escapeHtml(sharedText("photoFingerprints"))}</h3><table><thead><tr><th>${escapeHtml(sharedText("roomLabel"))}</th><th>${escapeHtml(sharedText("sanitizedHash"))}</th><th>${escapeHtml(sharedText("utcTimestamp"))}</th></tr></thead><tbody>${evidenceRows}</tbody></table><footer><strong>${disclaimer}</strong><br>${escapeHtml(sharedText("reportGenerated"))}</footer></section></main></body></html>`;
  }

  function openReport() {
    if (!allRooms().length) return;
    const report = window.open("", "_blank");
    if (!report) {
      showToast("Report blocked", "Allow pop-ups for this site, then choose Print report again.", true);
      return;
    }
    report.document.open();
    report.document.write(buildReport());
    report.document.close();
    report.document.getElementById("print-report")?.addEventListener("click", () => report.print());
    report.focus();
  }

  function resetApp() {
    if (state.running) return;
    state.rooms.clear();
    state.tiles.clear();
    state.files = [];
    state.meta = null;
    state.summary = null;
    state.queue = { active: 0, waiting: 0, limit: 2, closed: false };
    state.toast = null;
    state.done = false;
    state.interrupted = false;
    state.uploadError = null;
    state.selectedItem = null;
    state.selectedRoom = null;
    state.logs = { plain: [], technical: [] };
    $("results").hidden = true;
    $("intake").hidden = false;
    $("run-toast").hidden = true;
    $("selected-files").hidden = true;
    $("file-input").value = "";
    $("run-progress-bar").style.background = "var(--gold)";
    updateExportAvailability();
    loadHealth();
    $("intake").scrollIntoView({ block: "start" });
  }

  function bindEvents() {
    $("file-input").addEventListener("change", (event) => selectFiles(event.target.files));
    $("clear-files").addEventListener("click", () => {
      state.files = [];
      $("file-input").value = "";
      renderSelectedFiles();
      showUploadError("");
    });
    $("upload-form").addEventListener("submit", (event) => {
      event.preventDefault();
      startAnalysis(state.files, false);
    });
    $("sample-button").addEventListener("click", runSample);
    $("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    setTheme(document.documentElement.dataset.theme);
    setEnvironment({ text: sharedText("checkingWorkspace"), status: "checking" });
    setNosanaStatus(sharedText("nosanaChecking"));
    document.documentElement.lang = state.language;
    document.documentElement.dataset.language = state.language;
    $("language-label").textContent = state.language === "ja" ? "EN" : "日本語";
    $("language-toggle").setAttribute("aria-label", sharedText(state.language === "ja" ? "switchEnglish" : "switchJapanese"));
    $("quake-panel").lang = state.language;
    translateSharedUI();
    const drop = $("drop-zone");
    ["dragenter", "dragover"].forEach((type) => drop.addEventListener(type, (event) => {
      event.preventDefault();
      if (!state.running) drop.classList.add("is-dragging");
    }));
    ["dragleave", "drop"].forEach((type) => drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove("is-dragging");
    }));
    drop.addEventListener("drop", (event) => {
      if (!state.running && event.dataTransfer?.files) selectFiles(event.dataTransfer.files);
    });

    $("room-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-room-id]");
      if (!button || !state.rooms.has(button.dataset.roomId)) return;
      state.selectedRoom = button.dataset.roomId;
      if (state.selectedItem && findItem(state.selectedItem)?.room.id !== state.selectedRoom) state.selectedItem = null;
      renderRoomList();
      renderActiveRoom();
      renderInspector();
    });
    const itemActivation = (event) => {
      const target = event.target.closest?.("[data-item-id]");
      if (target && findItem(target.dataset.itemId)) selectItem(target.dataset.itemId);
    };
    $("photo-canvas").addEventListener("click", itemActivation);
    $("item-legend").addEventListener("click", itemActivation);
    $("photo-canvas").addEventListener("keydown", (event) => {
      if (["Enter", " "].includes(event.key) && event.target.matches("[data-item-id]")) {
        event.preventDefault();
        selectItem(event.target.dataset.itemId);
      }
    });
    $("inspector").addEventListener("click", (event) => {
      const edit = event.target.closest("#edit-item-button");
      if (edit) openEditor(edit.dataset.itemId);
      const duplicate = event.target.closest("[data-duplicate-action]");
      if (duplicate) resolveDuplicate(duplicate.dataset.itemId, duplicate.dataset.duplicateAction);
    });
    $("mode-insurance").addEventListener("click", () => setMode("insurance"));
    $("mode-quake").addEventListener("click", () => setMode("quake"));
    $("language-toggle").addEventListener("click", toggleLanguage);
    $("csv-button").addEventListener("click", exportCsv);
    $("report-button").addEventListener("click", openReport);
    $("reset-button").addEventListener("click", resetApp);
    $("dismiss-toast").addEventListener("click", () => { state.toast = null; $("run-toast").hidden = true; });

    $("item-form").addEventListener("submit", saveEdit);
    $("edit-price").addEventListener("input", updateAcvPreview);
    $("edit-condition").addEventListener("change", updateAcvPreview);
    $("close-item-dialog").addEventListener("click", () => $("item-dialog").close());
    $("cancel-edit-button").addEventListener("click", () => $("item-dialog").close());
    $("delete-item-button").addEventListener("click", askDelete);
    $("delete-form").addEventListener("submit", deleteItem);
    $("cancel-delete-button").addEventListener("click", () => $("delete-dialog").close());
    [$("item-dialog"), $("delete-dialog")].forEach((dialog) => dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }));

    [$("plain-log-tab"), $("technical-log-tab")].forEach((button) => {
      button.addEventListener("click", () => setLogTab(button.id.startsWith("plain") ? "plain" : "technical"));
      button.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? "plain" : event.key === "End" ? "technical" : state.logTab === "plain" ? "technical" : "plain";
          setLogTab(next, true);
        }
      });
    });
  }

  bindEvents();
  window.setInterval(updateFleetClocks, 500);
  renderLogs();
  loadHealth();
})();
