import fs from "fs";
import axios from "axios";
import lodash from "lodash";
import fetch from "node-fetch";
import proxyChain from "proxy-chain";
import puppeteer from "puppeteer-extra";
import { createCursor } from "ghost-cursor";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import TelegramBot from "node-telegram-bot-api";
import moment from "moment-timezone";
import UserAgent from "user-agents";
import path from "path";

import languages from "./browser-data/languages.js";

puppeteer.use(StealthPlugin());

// Get the current working directory
const owner = "leona"; // sukuna, leona
const captchaUserId = "jaouadeddadsi2016@gmail.com";
const captchaApikey = "qlfsQRF3b4swypsVAcnm";

const selectors = {
  "N.I.E.": "#rdbTipoDocNie",
  "D.N.I.": "#rdbTipoDocDni",
  PASAPORTE: "#rdbTipoDocPas",
  ID: "#txtIdCitado",
  "Nombre y apellidos": "#txtDesCitado",
  "Año de nacimiento": "#txtAnnoCitado",
  "País de nacionalidad": "#txtPaisNac",
  "Fecha de Caducidad de tu tarjeta actual": "#txtFecha",
};

function getFirstNumber() {
  const filePath = "./phones/mobiles.txt";
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const rawlines = data.split("\n");
    const lines = rawlines.filter((str) => str.length >= 6);
    if (lines.length === 0) return null;
    const firstLine = lines.shift();
    lines.push(firstLine);
    fs.writeFileSync(filePath, lines.join("\n"));
    return firstLine;
  } catch (err) {
    throw err;
  }
}

export async function fetchData() {
  const SEARCHDATA = {
    "N.I.E.": "Y2513630C",
    "D.N.I.": "29577584k",
    PASAPORTE: "Z12457",
  };
  const url = "https://dgtapp.vercel.app/api/pending";
  while (true) {
    try {
      const response = await axios.get(url);
      let data = response.data.data;
      let searchList = [];
      let datos = {};
      // Filter data by owner
      data = data.filter((item) => item.owner === owner);
      // make oficina list
      data = data.map((item) => {
        let oficina = item["oficina"].split("-");
        oficina = oficina.filter(
          (item) => item.trim() !== "" && item.trim() !== "99",
        );
        return { ...item, oficina };
      });
      data.forEach((client) => {
        const key = `${client.provincia}__${client.tramite}`;
        if (
          searchList.filter(
            (item) => `${item["provincia"]}__${item["tramite"]}` === key,
          ).length === 0
        ) {
          let searchData = lodash.cloneDeep(client);
          searchData["docId"] = SEARCHDATA[searchData["docType"]];
          searchList.push(searchData);
          datos[key] = [client];
        } else {
          datos[key].push(client);
        }
      });
      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }
}

export function getEmail() {
  // Use letters and digits for the random string
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Randomly select characters and join them into a string
  let randomString = "";
  for (let i = 0; i < 10; i++) {
    randomString += characters.charAt(
      Math.floor(Math.random() * characters.length),
    );
  }
  return `${randomString}@grr.la`;
}

export function sendMessageToGroup(owner, message) {
  const token = "8064000963:AAFgfMVj-AP_SaNfMAo_ghZVCsYhqGquUsM";
  const chadIds = {
    sukuna: "-1002226967850",
    leona: "-1002316821074",
    jaouad: "-4635162385",
  };
  const chatId = chadIds[owner];
  const bot = new TelegramBot(token);
  if (chatId) {
    bot
      .sendMessage(chatId, message)
      .then(() => {
        console.log("Message sent successfully!");
      })
      .catch((error) => {
        console.error("Error sending message");
      });
  }
  return;
}

export function getRandomItem(currentList, originalList) {
  if (currentList.length === 0) {
    // Reset the current list when it's empty
    currentList = lodash.cloneDeep(originalList);
  }
  // Choose a random index from the current list
  const randomIndex = Math.floor(Math.random() * currentList.length);
  const selectedItem = currentList[randomIndex];
  // Remove the selected item from the current list
  currentList.splice(randomIndex, 1);
  return [selectedItem, currentList];
}

export function getItem(currentList, originalList) {
  if (currentList.length === 0) {
    // Reset the current list when it's empty
    currentList = lodash.cloneDeep(originalList);
  }
  // Choose last item in the list
  const selectedItem = currentList.pop();
  return [selectedItem, currentList];
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// function to solve captcha
async function solveCaptcha(page) {
  const imgSrc = await page.$eval('img[alt="captcha"]', (img) => img.src);
  const image_data = imgSrc.replace(
    /^data:image\/(png|jpg|jpeg|gif);base64,/,
    "",
  );
  const params = {
    userid: captchaUserId,
    apikey: captchaApikey,
    data: image_data,
  };
  try {
    const urlCaptcha = "https://api.apitruecaptcha.org/one/gettext";
    const response = await fetch(urlCaptcha, {
      method: "post",
      body: JSON.stringify(params),
    });
    const data = await response.json();
    const code = data.result;
    await page.$eval("#captcha", (input) => (input.value = ""));
    await page.type("#captcha", code);
    await page.waitForFunction(
      (selector, expectedValue) => {
        return document.querySelector(selector).value === expectedValue;
      },
      { timeout: 5000 }, // 5 second timeout
      "#captcha", // selector argument
      code, // expectedValue argument
    );
  } catch (error) {
    telegramNotification("Check True captch solde");
  }
}

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split("/");
  return new Date(`${year}-${month}-${day}`);
};

function mergeOficinas(array1, array2) {
  if (!array2 || array2.length === 0) {
    return array1; // Rule 1: Return array1 if array2 is empty
  } else {
    // Rule 2: Return common values (intersection)
    return array1.filter((item) => array2.includes(item));
  }
}

export function readFileLines(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", (err, data) => {
      if (err) {
        return reject(err);
      }
      // Split the content into lines and filter out any empty lines
      const lines = data.split("\n").filter((line) => line.trim() !== "");
      resolve(lines);
    });
  });
}

function generateFingerprint() {
  const newUserAgent = new UserAgent({ deviceCategory: "desktop" });
  const userAgent = newUserAgent.toString();
  const language = languages[Math.floor(Math.random() * languages.length)];
  const timezone =
    moment.tz.names()[Math.floor(Math.random() * moment.tz.names().length)];
  const viewport = {
    width: 1280 + Math.floor(Math.random() * 100),
    height: 800 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1 + Math.random(),
  };
  return {
    userAgent,
    language,
    timezone,
    viewport,
  };
}

export async function deleteFolderRecursive(folderPath) {
  try {
    // Normalize the path to avoid issues with different OS path separators
    const normalizedPath = path.normalize(folderPath);

    // Safety check - don't allow deletion of root directories
    if (normalizedPath === path.parse(normalizedPath).root) {
      throw new Error("Attempted to delete root directory - operation blocked");
    }

    // Check if path exists
    if (!fs.existsSync(normalizedPath)) {
      console.warn(`Folder does not exist: ${normalizedPath}`);
      return;
    }

    // Check if it's actually a directory
    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${normalizedPath}`);
    }

    // Delete the folder (modern fs.rm with promise version)
    await fs.promises.rm(normalizedPath, {
      recursive: true,
      force: true,
      maxRetries: 3, // Retry on Windows lock issues
      retryDelay: 100, // Wait 100ms between retries
    });

    console.log(`Successfully deleted folder: ${normalizedPath}`);
  } catch (error) {
    console.error(`Failed to delete folder ${folderPath}:`, error);
    throw error; // Re-throw to allow caller to handle
  }
}

async function launchBrowserWithFingerprint(proxy) {
  const fingerprint = generateFingerprint();
  const newUrl = await proxyChain.anonymizeProxy(proxy);
  const profileDir = "./profiles/profile-" + Math.random();
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: profileDir,
    ignoreHTTPSErrors: true,
    args: [
      `--proxy-server=${newUrl}`,
      `--user-agent=${fingerprint.userAgent}`,
      `--window-size=${fingerprint.viewport.width},${fingerprint.viewport.height}`,
      `--lang=${fingerprint.language}`,
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--enable-webgl",
      "--use-gl=swiftshader",
      "--ignore-certificate-errors",
      "--disable-gpu", // Disable GPU hardware acceleration
      "--disable-dev-shm-usage", // Disable shared memory (useful in Docker)
      "--disable-setuid-sandbox", // Disable sandbox for security (use with caution)
      "--no-sandbox", // Disable sandbox (use with caution)
      "--no-zygote", // Disable zygote process (reduces memory usage)
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--ozone-platform=x11",
    ],
  });
  const page = await browser.newPage();
  // Set viewport and other fingerprint attributes
  await page.setViewport(fingerprint.viewport);
  await page.setUserAgent(fingerprint.userAgent);
  await page.setExtraHTTPHeaders({
    "Accept-Language": fingerprint.language,
  });
  await page.emulateTimezone(fingerprint.timezone);
  if (!page.waitForTimeout) {
    page.waitForTimeout = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms));
  }
  return { browser, page, profileDir };
}

async function savePageErrorSnapshot(page, error, folder = "error_snapshots") {
  try {
    // Create folder if needed
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    // Generate filename-safe string
    let cleanErrorMsg;
    if (error.message) {
      cleanErrorMsg = error.message.replace(/[^a-z0-9]/gi, "_").slice(0, 100); // Trim long messages
    } else {
      cleanErrorMsg = `${error}`;
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_");

    const filename = `${cleanErrorMsg}_${timestamp}`;

    // Save files
    await Promise.all([
      page.screenshot({
        path: path.join(folder, `${filename}.png`),
        fullPage: true,
      }),
      //fs.promises.writeFile(
      //  path.join(folder, `${filename}.html`),
      //  await page.content()
      //)
    ]);

    console.log(`Saved error snapshot: ${filename}`);
  } catch (saveError) {
    console.error("Failed to save snapshot:", saveError);
  }
}

async function waitForText(page, text, options = {}) {
  const {
    timeout = 30000, // Default 30 second timeout
    visible = true, // Check only visible text
    throwOnTimeout = true, // Throw error if timeout reached
    polling = 100, // Poll interval (ms)
  } = options;

  try {
    await page.waitForFunction(
      (text, visible) => {
        const content = visible
          ? document.body.innerText
          : document.body.textContent;
        return content.includes(text);
      },
      { timeout, polling },
      text,
      visible,
    );
  } catch (error) {
    if (throwOnTimeout) {
      throw new Error(`Text "${text}" not found within ${timeout}ms`);
    }
    return false;
  }
  return true;
}

async function savePageState(page) {
  // Save the page state
  const state = {
    html: await page.content(), // Save the HTML content
    cookies: await page.cookies(), // Save the cookies
  };
  return state;
}

async function loadPageState(page, state) {
  try {
    // Load the HTML content
    await page.setContent(state.html);
    // Load the cookies
    await page.setCookie(...state.cookies);
  } catch (error) {
    console.log("failed load state");
  }
}

// Get appointment
export async function getAppointment(data, proxy) {
  let usedOficinas = [];
  while (true) {
    let browser, page, profileDir;
    let requestHandler;
    const abortHandler = async () => {
      console.log("Abort triggered - cleaning up...");
      await browser?.close().catch(() => {});
      await deleteFolderRecursive(profileDir).catch(() => {});
    };
    try {
      ({ browser, page, profileDir } =
        await launchBrowserWithFingerprint(proxy));
      await page.setDefaultNavigationTimeout(20000);
      // Block additional resources
      await page.setRequestInterception(true);
      const requestHandler = (request) => {
        if (
          ["stylesheet", "font", "image", "media"].includes(
            request.resourceType(),
          )
        ) {
          request.abort();
        } else {
          request.continue();
        }
      };
      page.on("request", requestHandler);
      const cursor = createCursor(page);
      // Build url
      const url = `https://icp.administracionelectronica.gob.es${data["provincia"]}`;
      // ####################################### First page #################################
      const navigationPromise = page.goto(url, {
        waitUntil: "domcontentloaded",
      });
      await Promise.race([
        navigationPromise,
        page.waitForSelector("#btnAceptar", { timeout: 30000 }),
      ]);
      // Check for the selector
      await page.waitForSelector("#btnAceptar", { timeout: 30000 });
      //################################# select option ########
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ block: "center" });
        }
      }, "#btnAceptar");
      // click cookies if it appear
      if (await page.$("#cookie_action_close_header")) {
        try {
          await page.click("#cookie_action_close_header", { timeout: 2000 });
        } catch {
          console.log("Cookie banner click failed");
        }
      }
      try {
        await page.evaluate((tramiteCode) => {
          document.querySelector(`option[value="${tramiteCode}"]`).selected =
            true; // back to selector
        }, data["tramite"]);
        const tramite = String(data["tramite"]);
        await page.waitForFunction(
          (value) => document.querySelector(`option[value="${value}"]`),
          {},
          tramite,
        );
      } catch (error) {
        sendMessageToGroup(
          data["owner"],
          `Tramite not found:\n Provincia: ${data["provinciaLabel"]} \n Tramite: ${data["tramiteLabel"]}`,
        );
        continue;
      }
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ block: "center" });
        }
      }, "#btnAceptar");
      await page.locator("#btnAceptar").click();
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.waitForSelector("#btnEntrar", { timeout: 25000 }),
        page.waitForTimeout(10000),
      ]);
      // Check title
      let title = await page.title();
      if (title === "Request Rejected") {
        console.log("Fingerprint detected");
        continue;
      }
      await page.waitForSelector("#btnEntrar", { timeout: 2000 });
      // ##############################################  Second page ######
      // Scroll to the element and center it
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ block: "center" });
        }
      }, "#btnEntrar");
      await page.locator("#btnEntrar").click();
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.waitForSelector("#btnEnviar", { timeout: 25000 }),
        page.waitForTimeout(20000),
      ]);
      title = await page.title();
      if (title === "Request Rejected") {
        console.log("Fingerprint detected");
        continue;
      }
      await page.waitForSelector("#btnEnviar", { timeout: 5000 });

      // ############################################# Fill in info Page #######
      try {
        await page.click(selectors[data["docType"]], { timeout: 2000 }); // I am here
      } catch (error) {
        console.log("Error clicking the doc type");
      }
      await page.type("#txtIdCitado", data["docId"]); // Doc id
      await page.type("#txtDesCitado", data["nombre"]); // Name
      if (data["anoNacimiento"]) {
        await page.type("#txtAnnoCitado", data["anoNacimiento"]);
      }
      if (data["pais"]) {
        await page.evaluate((pais) => {
          document.querySelector(`option[value="${pais}"]`).selected = true; // back to selector
        }, data["pais"]);
      }
      if (data["fecha"]) {
        await page.type("#txtFecha", data["fecha"]);
      }
      // click continue
      await sleep(3000);
      await page.locator("#btnEnviar").click();
      await Promise.race([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.waitForSelector("#btnConsultar", { timeout: 15000 }),
        page.waitForTimeout(10000),
      ]);
      title = await page.title();
      if (title === "Request Rejected") {
        console.log("Fingerprint detected");
        continue;
      }
      try {
        await page.waitForSelector("#btnConsultar", { timeout: 5000 });
      } catch (error) {
        try {
          await page.waitForSelector("#btnEnviar", { timeout: 10 });
          sendMessageToGroup(
            data["owner"],
            `Error in data of client ${data["nombre"]} con ID ${data["docId"]}`,
          );
          return "done";
        } catch (error) {
          console.log("Data search error");
        }
        throw new Error("Error");
      }

      //#################################### check if its open #################################
      // Multiple try
      const state = await savePageState(page);
      let attempt = 0;
      while (attempt < 5) {
        // To adjust
        attempt += 1;
        try {
          await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (element) {
              element.scrollIntoView({ block: "center" });
            }
          }, "#btnEnviar");
          await page.locator("#btnEnviar").click();
          await Promise.race([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            waitForText(page, "Paso 1 de 5", { timeout: 15000 }),
            page.waitForTimeout(8000),
          ]);
          title = await page.title();
          if (title === "Request Rejected") {
            throw new Error("ABORTED");
          }
          // check Paso 1 de 5
          try {
            const content = await page.content();
            if (!content.includes("Paso 1 de 5")) {
              throw new Error("ABORTED");
            }
          } catch (error) {
            throw new Error("ABORTED");
          }
          try {
            await page.waitForSelector("#btnSiguiente", { timeout: 3000 }); // Check if it's open
            break;
          } catch (error) {
            // check if contain text
            const noDisponibila = await page.evaluate((str) => {
              return document.body.textContent.includes(str);
            }, "En este momento no hay citas disponibles.");
            if (noDisponibila) {
              throw new Error("ABORTED");
            }
            const hasAppointment = await page.evaluate((str) => {
              return document.body.textContent.includes(str);
            }, "Lo sentimos, pero has superado el máximo de citas en vigor para este trámite en la provincia seleccionada.");
            if (hasAppointment) {
              sendMessageToGroup(
                data["owner"],
                `⚠️ Client already has appointment ⚠️\n\n Nombre: ${data["nombre"]} \n Id: ${data["docId"]}`,
              );
              return "done";
            }
            throw new Error("ABORTED");
          }
        } catch (error) {
          // to check
          console.log(error);

          if (error.message === "ABORTED" || attempt > 4) throw error;
          console.log(
            `${data["provinciaLabel"]} tramite ${data["tramite"]} closed`,
          );
          await loadPageState(page, state);
        }
      }
      // ## keep the process
      await page.waitForSelector("#btnSalir", { timeout: 1000 });
      await page.waitForSelector("#btnSiguiente", { timeout: 1000 }); // Check if it's open
      //######################################### select oficina page ###
      const nonEmptyValues = await page.$$eval(
        "#idSede option",
        (options) =>
          options
            .filter((option) => option.value.trim()) // Filter options with non-empty values
            .map((option) => option.value), // Extract value and text
      );
      // Pick oficina
      let oficinas = mergeOficinas(nonEmptyValues, data["oficina"]);
      oficinas = oficinas.filter((item) => !usedOficinas.includes(item));
      if (oficinas.length === 0) {
        sendMessageToGroup(
          data["owner"],
          `Out of range oficina, nonEmpty ${nonEmptyValues}`,
        );
        continue;
      }
      console.log(oficinas);
      const chooseOficina = oficinas[0];
      await page.evaluate((value) => {
        document.querySelector(`option[value="${value}"]`).selected = true; // back to selector
      }, chooseOficina);
      // Find and click the button
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ block: "center" });
        }
      }, "#btnSiguiente");
      await Promise.all([
        page.locator("#btnSiguiente").click(),
        Promise.race([
          page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          page.waitForSelector("#txtTelefonoCitado", { timeout: 15000 }),
          page.waitForTimeout(10000),
        ]),
      ]);
      // Check title
      title = await page.title();
      if (title === "Request Rejected") {
        console.log("Fingerprint detected");
        continue;
      }
      await page.waitForSelector("#txtTelefonoCitado", { timeout: 10000 });
      // ###################################### fill in phone number and email
      let phone = await getFirstNumber();
      if (!phone) {
        sendMessageToGroup(
          data["owner"],
          "Can't get phone number check credit",
        );
        continue;
      }
      const email = getEmail();
      await page.type("#txtTelefonoCitado", `${phone}`);
      await page.type("#emailUNO", email);
      await page.type("#emailDOS", email);
      // write observation
      try {
        await page.type("#txtObservaciones", "Observations");
      } catch (error) {
        console.log("Observations not asked");
      }
      await sleep(3000);
      // click
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ block: "center" });
        }
      }, "#btnSiguiente");
      await Promise.all([
        page.locator("#btnSiguiente").click(),
        Promise.race([
          page.waitForNavigation({ waitUntil: "domcontentloaded" }),
          page.waitForSelector('img[alt="captcha"]', { timeout: 15000 }),
          page.waitForTimeout(10000),
        ]),
      ]);
      // ######################### select a date ##############""
      // Check title
      title = await page.title();
      if (title === "Request Rejected") {
        console.log("Fingerprint detected");
        continue;
      }
      // check if it loads correctly
      const noDisponibila = await page.evaluate((str) => {
        return document.body.textContent.includes(str);
      }, "En este momento no hay citas disponibles.");
      if (noDisponibila) {
        continue;
      }
      try {
        await page.waitForSelector('img[alt="captcha"]', { timeout: 5000 });
      } catch (error) {
        phone = null;
        console.log("Error phone number");
        sendMessageToGroup(data["owner"], `Phone number: ${phone} is blocked`);
        continue;
      }
      // select appointment
      const datePicker = await page.$("#datepicker");
      const dateMin = data["minDate"];
      const dateMax = data["maxDate"];
      // working here
      if (datePicker !== null) {
        const dayDatesElements = await page.$$('th[class^="colFecha"]');
        const dayDates = await Promise.all(
          dayDatesElements.map(async (element) => {
            return await element.evaluate((el) => [
              el.className,
              el.textContent.trim(),
            ]);
          }),
        );
        // scroll to the end
        let lastHeight = await page.evaluate("document.body.scrollHeight");
        while (true) {
          await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
          await page.waitForTimeout(500); // Wait for content to load
          const newHeight = await page.evaluate("document.body.scrollHeight");
          if (newHeight === lastHeight) break;
          lastHeight = newHeight;
        }
        let availabelDates = []; // back to it
        for (const dayDate of dayDates) {
          const links = await page.$$(`td.${dayDate[0]} a[role="button"]`);
          for await (const el of links) {
            availabelDates.push([dayDate[1], el]);
          }
        }
        availabelDates = availabelDates.filter((el) => {
          if (!el[0]) return false;
          const currentDate = parseDate(el[0]);
          const minDate = parseDate(dateMin);
          const maxDate = parseDate(dateMax);
          return (
            (!minDate || currentDate >= minDate) &&
            (!maxDate || currentDate <= maxDate)
          );
        });
        if (availabelDates.length === 0) {
          console.log("Apointment not in range");
          usedOficinas.push(chooseOficina);
          if (oficinas.length === 0) {
            break;
          }
          continue;
        }
        const randomLink =
          availabelDates[Math.floor(Math.random() * availabelDates.length)][1];
        await solveCaptcha(page);
        await randomLink.click();
      } else {
        const citasDivs = await page.$$('div[id^="cita_"]');
        const filteredAppointments = (
          await Promise.all(
            citasDivs.map(async (div) => {
              const spanText = await div
                .$eval("span:nth-of-type(2)", (span) => span.textContent.trim())
                .catch(() => null);
              const inputElement = await div.$("input").catch(() => null);
              return { spanText, inputElement }; // Return as object for clarity
            }),
          )
        )
          .filter(({ spanText }) => {
            if (!spanText) return false; // Skip if no date
            const currentDate = parseDate(spanText);
            const minDate = parseDate(dateMin);
            const maxDate = parseDate(dateMax);
            // Check if currentDate is within range (handles empty min/max)
            return (
              (!minDate || currentDate >= minDate) &&
              (!maxDate || currentDate <= maxDate)
            );
          })
          .map(({ spanText, inputElement }) => inputElement);
        if (filteredAppointments.length === 0) {
          console.log("Apointment not in range");
          usedOficinas.push(chooseOficina);
          if (oficinas.length === 0) {
            break;
          }
          continue;
        }
        const randomLink =
          filteredAppointments[
            Math.floor(Math.random() * filteredAppointments.length)
          ];
        await randomLink.click();
        await solveCaptcha(page);
        // await sleep(500); // check this
        //btnSiguiente
        await page.locator("#btnSiguiente").click();
      }
      await page.waitForSelector("div.jconfirm-buttons > button:nth-child(1)", {
        timeout: 5000,
      });
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        cursor.click("div.jconfirm-buttons > button:nth-child(1)", {
          moveDelay: 0,
          randomizeMoveDelay: false,
        }),
      ]);
      // #################### final page ############
      // Check title
      title = await page.title();
      if (title === "Request Rejected") {
        throw new Error("Fingerprint detected");
      }
      // check it load next page
      await page.waitForSelector("#btnConfirmar", { timeout: 5000 });
      sendMessageToGroup(
        data["owner"],
        `🔔Cita encontrada🔔\n\n📝 Tramite: ${data["tramiteLabel"]}\n\n📍CITADO: ${data["nombre"]}  - ${data["docId"]}\n\n🏢 Phone: ${phone}\n\n Email: ${email}`,
      );
      // give time for verification
      await page.waitForFunction(
        () => {
          const input = document.querySelector("#txtCodigoVerificacion");
          return input && input.value.trim() !== "";
        },
        { timeout: 300000 }, // 5 minutes
      );
      await sleep(40000); // 1 minute to finish the process
      console.log("Done");
      return "done";
    } catch (error) {
      console.log(error);
    } finally {
      page?.off("request", requestHandler);
      await browser?.close();
      await deleteFolderRecursive(profileDir);
    }
  }
}
