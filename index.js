const mongoose = require("mongoose");
const puppeteer = require("puppeteer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");

dotenv.config();
mongoose.connect(process.env.MONGODB_URI, {
	dbName: "anonmsg"
});

const Message = mongoose.model(
	"Message",
	new mongoose.Schema({
		text: String,
		timestamp: Number,
	}),
	"messages",
);

const OUTPUT_DIR = path.join(__dirname, "messages");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const TEMPLATE_PATH = path.join(__dirname, "template.html");
const tempHtmlPath = path.join(__dirname, "temp.html");

async function generateScreenshots(cutoffTimestamp) {
	try {
		const messages = await Message.find({
			timestamp: { $gt: cutoffTimestamp },
		}).sort({ timestamp: 1 });

		if (messages.length === 0) {
			console.log("No messages found.");
			return;
		}

		const templateHtml = fs.readFileSync(TEMPLATE_PATH, "utf8");

		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		for (const message of messages) {
			const filePath = path.join(OUTPUT_DIR, `${message.timestamp}.png`);

			const htmlContent = templateHtml
				.replace("{{TEXT}}", message.text.replaceAll("\n", "<br>"))
				.replace(
					"{{TIMESTAMP}}",
					dayjs.unix(message.timestamp).format("D/M/YY h:mm:ss A"),
				);

			fs.writeFileSync(tempHtmlPath, htmlContent);

			await page.goto(`file://${tempHtmlPath}`, { waitUntil: "load" });

			await page.setViewport({
				width: 650,
				height: 300,
				deviceScaleFactor: 3,
			});
			await page.screenshot({ path: filePath, fullPage: true });
			console.log(`Saved: ${filePath}`);
		}

		await browser.close();
	} catch (error) {
		console.error("Error:", error);
	} finally {
		mongoose.connection.close();
		if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
		console.log("Done!");
	}
}

const cutoffTimestamp = process.argv[2] ? Number.parseInt(process.argv[2]) : 0;

console.log(
	"Generating screenshots from messages with timestamp >",
	cutoffTimestamp,
);

generateScreenshots(cutoffTimestamp);
