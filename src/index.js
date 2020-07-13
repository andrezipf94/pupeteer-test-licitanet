const { performance } = require("perf_hooks");
const puppeteer = require("puppeteer");

const BIDDINGS_URI = "https://licitanet.com.br/processos.html";

const crawlBiddings = async (page, listingParser) => {
  await page.goto(BIDDINGS_URI, { waitUntil: "networkidle2" });

  const filterDtInicio = await page.$("#dataInicio");
  await filterDtInicio.type("01012010");

  const tabHomologados = await page.$("#homologados-tab");
  await tabHomologados.click();

  await page.waitFor(300);

  const buttonBuscar = await page.$("#buttonBusca");
  await buttonBuscar.click();

  await page.waitFor(
    () => !!document.querySelector("#processo-homologados > div")
  );

  const elProcessos = await page.$$("#processo-homologados > div");
  let processos = [];
  for (let index in elProcessos) {
    let elProcesso = elProcessos[index];
    let processo = await listingParser(elProcesso);
    processos.push(processo);
  }
  await page.close();
  return processos;
};

const biddingListingParser = async (element) => {
  const elNrPregao = await element.$("div div:nth-child(2) > p:nth-child(2)");
  const elMunicipio = await element.$(
    "div > div:nth-child(3) > p:nth-child(2)"
  );
  const elOptionsDocumentos = await element.$$("#relatorios > option");

  let docs = [];
  for (let index in elOptionsDocumentos) {
    let optionDoc = elOptionsDocumentos[index];

    let innerText = await (
      await optionDoc.getProperty("innerText")
    ).jsonValue();
    if (innerText === "Selecione") continue;

    let value = await (await optionDoc.getProperty("value")).jsonValue();
    docs.push({
      documento: innerText,
      uri: value,
    });
  }

  return docs;
};

const newDryPage = async (browser) => {
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (
      ["image", "stylesheet", "font"].indexOf(request.resourceType()) !== -1
    ) {
      request.abort();
    } else {
      request.continue();
    }
  });

  return page;
};

(async () => {
  try {
    const t0 = performance.now();

    const browser = await puppeteer.launch();
    const page = await newDryPage(browser);
    const res = await crawlBiddings(page, biddingListingParser);
    await browser.close();

    const t1 = performance.now();
    console.info(`Parsed 10 results in ${(t1 - t0) / 1000} seconds`);
    // console.info(`Results:`);
    // console.log(res);

    return true;
  } catch (e) {
    console.error(e);
    browser.close();
    return false;
  }
})();
