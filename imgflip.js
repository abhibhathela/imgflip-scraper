const fs = require("fs");
const cheerio = require("cheerio");
const { Curl, curly } = require("node-libcurl");

const baseUrl = "https://imgflip.com";

function getPageHtml(url, referer) {
  return new Promise((resolve, reject) => {
    const curl = new Curl();

    curl.setOpt("URL", url);
    curl.setOpt("FOLLOWLOCATION", true);
    curl.setOpt("HTTPGET", true);
    curl.setOpt(
      Curl.option.USERAGENT,
      "Axios/2.18.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/"
    );
    curl.setOpt(Curl.option.REFERER, referer);
    curl.setOpt(Curl.option.ACCEPT_ENCODING, "gzip, deflate, br");
    curl.setOpt(Curl.option.HEADER, true);
    curl.setOpt(Curl.option.HTTPHEADER, ["Host", "imgflip.com"]);

    curl.on("end", function (statusCode, data, headers) {
      console.info(`success ${url} :: ${statusCode}`);
      this.close();

      resolve(data);
    });

    curl.on("error", () => {
      curl.close.bind(curl);
      //? add log in file for failed url
      reject();
    });

    curl.perform();
  });
}

async function downloadImage(imageUrl, imagePath) {
  try {
    const { statusCode, data } = await curly.get(imageUrl);
    if (statusCode === 200) {
      fs.appendFileSync(`imgflip/${imagePath}`, data);
    } else {
      fs.appendFileSync(
        `failed.txt`,
        `failed to downalod image ::> ${imageUrl}`
      );
    }
  } catch (e) {
    console.error(e);
    fs.appendFileSync(`failed.txt`, `failed to downalod image ::> ${imageUrl}`);
  }
}

async function getImageSrc(pageHref, referrer) {
  const url = `${baseUrl}${pageHref}`;
  const data = await getPageHtml(url, referrer);

  const $ = cheerio.load(data);
  const imageUrl = $(".meme-link img").attr("src");

  if (!imageUrl) {
    console.log("no image url", `${baseUrl}${pageHref}`);
    fs.appendFileSync(`failed.txt`, `${baseUrl}${pageHref}`);
  }

  return imageUrl;
}

async function run() {
  for (let index = 1; index <= 50; index++) {
    // get html from imgflip
    const mainPageUrl = `${baseUrl}/memetemplates?sort=top-all-time&page=${index}`;

    // use axios to get html
    const mainHtml = await getPageHtml(mainPageUrl, baseUrl);

    const $ = cheerio.load(mainHtml);

    const pageHrefs = $(".mt-img-wrap")
      .map((i, el) => {
        const aTag = $(el).find("a").attr("href");
        const divTag = $(el).find("div").attr("class");
        // this will ignore gif file
        if (!divTag) return aTag;
      })
      .get();

    const imageSrcs = await Promise.all(
      pageHrefs.map((pageHref) => getImageSrc(pageHref, mainPageUrl))
    );

    const downalodPromises = imageSrcs.map((imageSrc, index) => {
      const hosted = imageSrc.startsWith("//i.imgflip");
      const imageAbsoluteSrc = `${hosted ? "https:" : baseUrl}${imageSrc}`;
      const imageName = imageSrc.split("/").pop();

      return downloadImage(imageAbsoluteSrc, imageName);
    });

    await Promise.all(downalodPromises);

    //! generic 1 sec delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`::::::   page ${index} done ::::::`);
  }
}

try {
  run();
} catch (e) {
  console.error(e);
}
