// ==UserScript==
// @name         우마무스메 자동 마신표 제작기
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  우마무스메 레이스 에뮬레이터로 마신표를 자동으로 만드는 스크립트입니다.
// @author       Ravenclaw5874
// @match        http://race-ko.wf-calc.net/
// @match        http://race.wf-calc.net/
// @match        https://ravenclaw5874.github.io/uma-emu/
// @match        https://sekwan5.github.io/uma-race-simulate/
// @match        http://localhost:8080/uma-emu/
// @match        http://localhost:8080/
// @icon         https://img1.daumcdn.net/thumb/C151x151/?fname=https%3A%2F%2Ft1.daumcdn.net%2Fcafeattach%2F1ZK1D%2F80ed3bb76fa6ce0a4a0c7a9cc33d55430f797e35
// @grant        GM_getResourceText
// @require      http://code.jquery.com/jquery-3.6.1.min.js
// @resource skillDBTsv https://raw.githubusercontent.com/sekwan5/Auto-Table-Generator/main/skillDbBefore2.5Year.tsv
// @license      MIT License
// ==/UserScript==

const selector = {
  "평균 랩타임":
    "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)",
  "표준 편차":
    "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(3)",
  "베스트 랩타임":
    "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(4)",
  "워스트 랩타임":
    "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(5)",
  "드롭다운 부모":
    "body > div.el-select-dropdown.el-popper:last-child > div > div > ul",
  "고유기 레벨": "#app > div.main-frame > form > div:nth-child(24) > div > div",
};

const xpath = {
  "진행도 바":
    "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[6]/div/div[2]/div[@role='progressbar']",
  "스킬 발동 구간":
    "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[5]/div/div/div[contains(@class, 'el-input')]",
  "한번 버튼":
    "/html/body/div/div[1]/form/div[position()=22 or position()=23]/div[3]/div/button",
  "여러번 버튼":
    "/html/body/div/div[1]/form/div[position()=22 or position()=23]/div[1]/div/button",
  "시뮬 횟수":
    "/html/body/div/div[1]/form/div[position() > 20]/div[2]/div/div/div/input",
  "스킬 발동률 설정":
    "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[4]/div/div/div[contains(@class, 'el-input')]",
  "녹딱 레어":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[1]/div[2]/div/div[1]//div[@role='group']",
  "녹딱 일반":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[1]/div[2]/div/div[2]//div[@role='group']",
  "회복 계승":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[2]/div[2]/div/div[3]//div[@role='group']",
  "속도 레어":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[1]//div[@role='group']",
  "속도 일반":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[2]//div[@role='group']",
  "속도 계승":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[3]//div[@role='group']",
  "가속 레어":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[1]//div[@role='group']",
  "가속 일반":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[2]//div[@role='group']",
  "가속 계승":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[3]//div[@role='group']",
  "복합 레어":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[1]//div[@role='group']",
  "복합 일반":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[2]//div[@role='group']",
  "복합 계승":
    "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[3]//div[@role='group']",
  진화: "/html/body/div[1]/div[1]/form/div[21][@class='el-form-item']/div/div",
};
// 전역 변수 선언
let skillDB,
  userSelected,
  isPredict,
  totalSimulateCount,
  currentSimulateCount,
  currentOnceCount,
  currentMultipleCount,
  userSimulateCount;
let isUniqueSkillSelected, no_unique_skill_element;
Node.prototype.xpath = function (xpath) {
  return document.evaluate(
    xpath,
    this,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
};

function tsvToDictionaryArray(tsv) {
  const lines = tsv.split(/\r?\n/);
  const headers = lines[0].split("\t");
  return lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const fields = line.split("\t");
      return headers.reduce((obj, header, index) => {
        obj[header] = fields[index];
        return obj;
      }, {});
    });
}

function downloadDictionaryArrayAsTSV(dictionaryArray, filename, firstLine) {
  const longest = dictionaryArray.reduce(
    (max, obj) =>
      Object.keys(obj).length > Object.keys(max).length ? obj : max,
    dictionaryArray[0]
  );
  const keys = Object.keys(longest);
  const rows = [
    keys,
    ...dictionaryArray.map((obj) => keys.map((key) => obj[key])),
  ];
  const tsv = firstLine + rows.map((row) => row.join("\t")).join("\n");
  const blob = new Blob([tsv], { type: "text/tab-separated-values" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${filename}.tsv`;
  link.href = url;
  link.click();
}

function getIndex(element) {
  return Array.from(element.parentNode.children).indexOf(element);
}

async function clickElements(selectors) {
  for (const selector of selectors) {
    if (typeof selector === "string") {
      await document.querySelector(selector).click();
    } else {
      await selector.click();
    }
  }
}

function simulate(once) {
  return new Promise(async (resolve) => {
    if (isPredict) {
      currentSimulateCount += once ? 1 : userSimulateCount + 5;
      resolve({
        평균: 1,
        베스트: 1,
        워스트: 1,
        "표준 편차": "0.000",
        "타임 배열": [1],
      });
    } else {
      const target = document.xpath(xpath["진행도 바"]);
      const observer = new MutationObserver(async (mutations) => {
        if (target.ariaValueNow === "100") {
          observer.disconnect();
          const average = convertToSec(
            document.querySelector(selector["평균 랩타임"]).innerText
          );
          const SD = document.querySelector(selector["표준 편차"]).innerText;
          const eachTimes = document
            .querySelector("#allRaceTime")
            .value.split(", ");
          let fastest, slowest;

          once
            ? currentOnceCount++
            : (currentMultipleCount += userSimulateCount);
          currentSimulateCount = currentOnceCount + currentMultipleCount;
          updateProgressBar(currentSimulateCount, totalSimulateCount);

          if (!once) {
            const randomPosition_Results = [
              convertToSec(
                document.querySelector(selector["베스트 랩타임"]).innerText
              ),
              convertToSec(
                document.querySelector(selector["워스트 랩타임"]).innerText
              ),
              ...(await Promise.all(
                Array.from({ length: 5 }, async (_, i) => {
                  await randomPosition_Parent.childNodes[i + 2].click();
                  return (await simulate(true))["평균"];
                })
              )),
            ];
            fastest = Math.min(...randomPosition_Results);
            slowest = Math.max(...randomPosition_Results);
            await randomPosition_Parent.childNodes[1].click();
          } else {
            fastest = slowest = average;
          }

          resolve({
            평균: average,
            베스트: fastest,
            워스트: slowest,
            "표준 편차": SD,
            "타임 배열": eachTimes,
          });
        }
      });

      observer.observe(target, { characterData: true, subtree: true });
      await document
        .xpath(once ? xpath["한번 버튼"] : xpath["여러번 버튼"])
        .click();
      document.querySelector("body > div.v-modal").remove();
    }
  });
}

function convertToSec(minSec) {
  const [min, sec] = minSec.split(":").map(Number);
  return (min * 60 + sec).toFixed(3) * 1;
}

function calculateMedian(array) {
  const sorted = [...array].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcBashin(BASETIME, times) {
  if (typeof times === "number") {
    return ((BASETIME - times) * 10).toFixed(2) * 1;
  }
  const result = {
    평균: ((BASETIME - times["평균"]) * 10).toFixed(2) * 1,
    최대: ((BASETIME - times["베스트"]) * 10).toFixed(2) * 1,
    최소: ((BASETIME - times["워스트"]) * 10).toFixed(2) * 1,
    "표준 편차": (times["표준 편차"] * 10).toFixed(2) * 1,
    "마신 배열": times["타임 배열"].map(
      (time) => ((BASETIME - time) * 10).toFixed(2) * 1
    ),
  };
  result["중앙"] = calculateMedian(result["마신 배열"]).toFixed(2) * 1;
  return result;
}

// ... 나머지 함수들

async function main(current, all) {
  // ... main 함수 내용
}

async function predict_main(current, all) {
  resetGlobalVariables();
  isPredict = true;
  await main(current, all);
  totalSimulateCount = currentSimulateCount;
  currentSimulateCount = 0;
  console.log(`예상 시뮬 횟수 : ${totalSimulateCount}`);
  isPredict = false;
  await main(current, all);
  console.log(`실제 시뮬 횟수 : ${currentSimulateCount}`);
}

async function filterStart(filterString) {
  await clickElements([
    "#app > div.main-frame > form > div:nth-child(2) > div > div",
    "#app > div.main-frame > form > div:nth-child(2) > div > div",
  ]);

  const saved_Uma_NodeList = Array.from(
    document.querySelectorAll(
      "body > div:last-child > div:nth-child(1) > div:nth-child(1) > ul > li.el-select-dropdown__item"
    )
  ).filter(
    (node) => filterString === "" || node.innerText.includes(filterString)
  );

  const skillDB_tsv = await $.get(
    "https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%202.5%EC%A3%BC%EB%85%84%20%EC%A0%84.tsv"
  );
  skillDB = tsvToDictionaryArray(skillDB_tsv);
  console.log(skillDB);

  if (saved_Uma_NodeList.length === 0) {
    await main(1, 1);
  } else {
    for (let i = 0; i < saved_Uma_NodeList.length; i++) {
      await saved_Uma_NodeList[i].click();
      await document
        .querySelector(
          "#app > div.main-frame > form > div:nth-child(3) > div > button"
        )
        .click();
      await main(i + 1, saved_Uma_NodeList.length);
    }
  }
}

function createNode() {
  const filterInput = document
    .querySelector("#app > div.main-frame > form > div:nth-child(8)")
    .cloneNode(true);
  const filterNode = filterInput.querySelector("div > div > input");
  filterNode.setAttribute("placeholder", "필터");
  filterInput.removeChild(filterInput.firstChild);

  const button = document.createElement("button");
  button.setAttribute("class", "el-button el-button--success");
  button.innerText = "마신표 제작 시작";
  button.onclick = () => filterStart(filterNode.value);

  const div = document.createElement("div");
  div.setAttribute("class", "el-form-item");
  div.appendChild(filterInput);
  div.appendChild(button);

  return div;
}

function checkURL() {
  if (!location.hash.includes("champions-meeting")) return;
  document
    .querySelector("#app > div.main-frame > form")
    .appendChild(createNode());
}

// 전체 진행도 바 생성
function createProgressBar(current, all) {
  let original = document.xpath(xpath["진행도 바"]);
  let newProgressbar = original.cloneNode(true);
  original.after(newProgressbar);
  newProgressbar.before(`(${current}/${all})단계 완료까지`);
  newProgressbar.before(" 약 h시간 mm분 ss초");

  return newProgressbar;
}

// 전체 진행도 바 제거
function removeProgressBar(progressbar) {
  progressbar.previousSibling.remove();
  progressbar.previousSibling.remove();
  progressbar.remove();
}

async function calculateAptitude(BASETIME) {
  const result = [];
  const index_dist = getIndex(userSelected["거리 적성"]);
  const index_surf = getIndex(userSelected["경기장 적성"]);

  for (let i = 0; i <= (index_dist === 0 ? 1 : index_dist); i++) {
    for (let j = 0; j <= (index_surf === 0 ? 1 : index_surf); j++) {
      await dropDownParent["거리 적성"].children[i].click();
      await dropDownParent["경기장 적성"].children[j].click();

      const bashins = calcBashin(BASETIME, await simulate(true));
      result.push({
        희귀: "적성",
        분류: "적성",
        마신: bashins["평균"],
        "스킬명(나무)": `${userSelected["거리 분류"]}${dropDownParent["거리 적성"].children[i].innerText} ${userSelected["마장"]}${dropDownParent["경기장 적성"].children[j].innerText}`,
        "예상 출시일": "2022년 6월 20일",
      });
    }
  }

  const lastBashin = result[result.length - 1]["마신"];
  if (lastBashin < 0) {
    result.forEach((row) => {
      row["마신"] += -lastBashin;
      row["마신"] = parseFloat(row["마신"].toFixed(2));
    });
  }

  await userSelected["거리 적성"].click();
  await userSelected["경기장 적성"].click();

  return result;
}

async function calculatePassiveSkills(BASETIME) {
  const passiveParents = {
    상위: document.xpath(xpath["녹딱 레어"]),
    하위: document.xpath(xpath["녹딱 일반"]),
  };

  const result = [];
  for (const [rarity, parent] of Object.entries(passiveParents)) {
    const skillElements = parent.querySelectorAll("label");
    result.push(
      ...(await makeCompleteSkillDatas(skillElements, rarity, "녹딱"))
    );
  }

  return result;
}

async function calculateNormalSkills(BASETIME) {
  const normalSkillElements = {
    속도: {
      "레어/상위": document.xpath(xpath["속도 레어"]).querySelectorAll("label"),
      "일반/하위": document.xpath(xpath["속도 일반"]).querySelectorAll("label"),
      계승: document.xpath(xpath["속도 계승"]).querySelectorAll("label"),
    },
    가속: {
      "레어/상위": document.xpath(xpath["가속 레어"]).querySelectorAll("label"),
      "일반/하위": document.xpath(xpath["가속 일반"]).querySelectorAll("label"),
      계승: document.xpath(xpath["가속 계승"]).querySelectorAll("label"),
    },
    복합: {
      "레어/상위": document.xpath(xpath["복합 레어"]).querySelectorAll("label"),
      "일반/하위": document.xpath(xpath["복합 일반"]).querySelectorAll("label"),
      계승: document.xpath(xpath["복합 계승"]).querySelectorAll("label"),
    },
  };

  const result = [];
  for (const category of Object.keys(normalSkillElements)) {
    for (const [rarity, elements] of Object.entries(
      normalSkillElements[category]
    )) {
      result.push(
        ...(await makeCompleteSkillDatas(elements, rarity, category))
      );
    }
  }

  return result;
}

async function calculateUniqueSkills(BASETIME) {
  if (isUniqueSkillSelected) {
    return [];
  }

  const unique_Skill_Elements = document
    .xpath(xpath["진화"])
    .querySelectorAll("label");
  const result = await makeCompleteSkillDatas(unique_Skill_Elements, "고유");

  await no_unique_skill_element.click();

  return result;
}

function generateFilename(userSelected) {
  let filename = `${userSelected["각질"]} - ${userSelected["코스 장소"]} ${userSelected["코스 종류 및 거리"]} ${userSelected["코스 상태"]}`;

  if (isUniqueSkillSelected) {
    filename += ` (고유 ${userSelected["고유기"]})`;
  }
  if (userSelected["계승/일반기"].length > 0) {
    filename += ` (일반 ${userSelected["계승/일반기"].join(", ")})`;
  }

  return filename;
}

function generateFirstLine(userSelected) {
  let firstLine = [
    userSelected["코스 장소"],
    userSelected["마장"],
    userSelected["거리"],
    userSelected["거리 분류"],
    userSelected["코스 상태"],
    userSelected["각질"],
    userSelected["스탯"].join("/"),
    userSelected["거리 적성"].innerText,
    userSelected["경기장 적성"].innerText,
    userSelected["각질 적성"],
    userSelected["컨디션"],
    userSelected["고유기 레벨"],
    userSimulateCount,
    userSelected["내외"],
    isUniqueSkillSelected ? userSelected["고유기"] : "",
    userSelected["계승/일반기"].length > 0
      ? userSelected["계승/일반기"].join(", ")
      : "",
  ].join("\t");

  return firstLine + "\n\n";
}

function getUserSelected() {
  return {
    "코스 장소": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(4) > div > div > div > input"
    ).value,
    마장: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(5) > div > div > div > input"
    ).value,
    거리: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(6) > div > div > div > input"
    ).value,
    "거리 분류": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(7) > div > div > div > input"
    ).value,
    "코스 상태": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(8) > div > div > div > input"
    ).value,
    각질: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(9) > div > div > div > input"
    ).value,
    스탯: Array.from(
      document.querySelectorAll(
        "#app > div.main-frame > form > div:nth-child(10) > div > div > div > input"
      )
    ).map((input) => input.value),
    "거리 적성": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(11) > div > div > div.el-select__tags > span"
    ),
    "경기장 적성": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(12) > div > div > div.el-select__tags > span"
    ),
    "각질 적성": document.querySelector(
      "#app > div.main-frame > form > div:nth-child(13) > div > div > div > input"
    ).value,
    컨디션: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(14) > div > div > div > input"
    ).value,
    "고유기 레벨": document.querySelector(selector["고유기 레벨"]).innerText,
    내외: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(16) > div > div > div > input"
    ).value,
    고유기: document.querySelector(
      "#app > div.main-frame > form > div:nth-child(21) > div > div > div > input"
    ).value,
    "계승/일반기": Array.from(
      document.querySelectorAll(
        "#app > div.main-frame > form > div:nth-child(22) > div > div > div.el-select__tags > span"
      )
    ).map((span) => span.innerText),
  };
}

function resetGlobalVariables() {
  isPredict = false;
  totalSimulateCount = 0;
  currentSimulateCount = 0;
  currentOnceCount = 0;
  currentMultipleCount = 0;
  userSimulateCount = parseInt(document.xpath(xpath["시뮬 횟수"]).value);
}

function updateProgressBar(current, total) {
  const progressBar = document.querySelector("#entire_progressbar");
  if (progressBar) {
    progressBar.style.width = `${(current / total) * 100}%`;
    progressBar.textContent = `${current} / ${total}`;
  }
}

function addRatio(skillData, bashins) {
  const total = bashins["마신 배열"].length;
  skillData["1마신 이상"] = (
    (bashins["마신 배열"].filter((v) => v >= 1).length / total) *
    100
  ).toFixed(2);
  skillData["2마신 이상"] = (
    (bashins["마신 배열"].filter((v) => v >= 2).length / total) *
    100
  ).toFixed(2);
  skillData["3마신 이상"] = (
    (bashins["마신 배열"].filter((v) => v >= 3).length / total) *
    100
  ).toFixed(2);
}

async function makeCompleteSkillDatas(skillElements, rarity, category = "") {
  const result = [];
  for (const skillElement of skillElements) {
    result.push(
      ...(await makeCompleteSkillData(skillElement, rarity, category))
    );
  }
  return result;
}

async function main(current, all) {
  resetGlobalVariables();
  userSelected = getUserSelected();

  const entire_progressbar = createProgressBar(current, all);
  document
    .querySelector("#app > div.main-frame > form")
    .insertBefore(
      entire_progressbar,
      document.querySelector("#app > div.main-frame > form > div:nth-child(2)")
    );

  const BASETIME = (await simulate(true))["평균"];
  console.log("기준 타임: " + BASETIME);

  // 드롭다운 요소들의 부모들 저장용
  let dropDownParent = {
    각질: dropDownNodes[dropDownNodes.length - 9].querySelector(
      "div > div > ul"
    ),
    "거리 적성":
      dropDownNodes[dropDownNodes.length - 8].querySelector("div > div > ul"),
    "경기장 적성":
      dropDownNodes[dropDownNodes.length - 7].querySelector("div > div > ul"),
    "각질 적성":
      dropDownNodes[dropDownNodes.length - 6].querySelector("div > div > ul"),
    컨디션:
      dropDownNodes[dropDownNodes.length - 5].querySelector("div > div > ul"),
    "코스 장소":
      dropDownNodes[dropDownNodes.length - 4].querySelector("div > div > ul"),
    "코스 종류 및 거리":
      dropDownNodes[dropDownNodes.length - 3].querySelector("div > div > ul"),
    "코스 상태":
      dropDownNodes[dropDownNodes.length - 2].querySelector("div > div > ul"),
    고유기:
      dropDownNodes[dropDownNodes.length - 1].querySelector("div > div > ul"),
  };

  // randomPosition_Parent 정의
  const randomPosition_Parent = document.querySelector(
    "#app > div.main-frame > form > div:nth-child(16) > div > div"
  );

  async function makeCompleteSkillData(
    skillElement,
    rarity,
    category = "",
    custom_skillName = "",
    is777 = false
  ) {
    // ... (기존 코드)

    // 최속으로 바꿨으면 다시 랜덤으로 돌리기
    if (skillData["최속"] === "TRUE") {
      await randomPosition_Parent.childNodes[1].click();
    }

    // ... (기존 코드)
  }

  const result_Final = {
    적성: await calculateAptitude(BASETIME),
    녹딱: await calculatePassiveSkills(BASETIME),
    일반기: await calculateNormalSkills(BASETIME),
    고유기: await calculateUniqueSkills(BASETIME),
  };

  removeProgressBar(entire_progressbar);
  console.log(`실제 시뮬 횟수 : ${currentSimulateCount}`);

  if (!isPredict) {
    const filename = generateFilename(userSelected);
    const firstLine = generateFirstLine(userSelected);
    const result = [
      ...result_Final["적성"],
      ...result_Final["녹딱"],
      ...result_Final["고유기"],
      ...result_Final["일반기"],
    ];
    downloadDictionaryArrayAsTSV(result, filename, firstLine);
  }
}

// 메인 실행
checkURL();
