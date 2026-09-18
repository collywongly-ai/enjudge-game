# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML, CSS, and JavaScript with no third-party libraries

## Users

幼兒與低年級兒童，在手機或平板上進行英語聽辨、看圖與單詞認讀練習；照顧者可用累計統計了解練習量。

## Product Purpose

播放英文單詞、展示圖片與英文大字，讓孩子判斷兩者是否相符。成功標準是孩子能在大按鈕、低閱讀負擔的介面中反覆練習，並得到即時鼓勵。

## Positioning

將聽音、看圖、看字三種輸入固定在同一題中，且答錯時留在原題重試，不因猜錯而中斷學習節奏。

## Operating Context

網站以 HTTP 伺服器開啟，從同目錄的 JSON 題庫載入資料；可部署到 Vercel 或 GitHub Pages。語音使用瀏覽器 Web Speech API。

## Capabilities and Constraints

- 題庫使用 `wordJudge` 陣列，每題包含 `word`、`imgPath`、`isMatch`。
- 顯示文字永遠來自當前題目的 `word`，不根據圖片替換。
- 答錯不跳題；答對後延遲切換下一題。
- 使用 `localStorage` 保存 `enJudgeRightCount` 與 `enJudgeTotalCount`。
- 介面手機優先、按鈕適合幼兒觸控、純前端且不引用第三方庫。

## Brand Commitments

明亮、友善、簡潔的兒童學習風格；使用清楚的繁體中文提示與大尺寸英文字。

## Evidence on Hand

本專案使用本地示範題庫與本地 SVG 圖片資產；未提供外部品牌、真人照片或教學內容。

## Product Principles

1. 每題都同時看得到圖、字與播放操作。
2. 錯誤是可重試的學習訊號，不是流程終點。
3. 每個主要操作都要大、清楚且容易找到。
4. 回饋要即時、溫暖且不造成壓力。
