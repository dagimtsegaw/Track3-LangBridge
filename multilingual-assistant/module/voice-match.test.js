import test from "node:test";
import assert from "node:assert/strict";
import { matchCommand, matchHeading, matchLanguage, chunkText } from "./voice-match.js";

const english = {
  open: ["open assistant", "open the assistant"],
  close: ["close assistant"],
  readPage: ["read this page"],
  stopReading: ["stop reading", "stop speaking"],
  scrollTop: ["go to the top"],
  goToSection: ["go to section"],
  changeLanguage: ["change language to"],
  help: ["help"],
};

const amharic = {
  open: ["ረዳቱን ክፈት"],
  goToSection: ["ወደ ክፍል ሂድ"],
  help: ["እርዳታ"],
};

test("exact phrases and the longer phrase win", function () {
  assert.equal(matchCommand("Open the assistant", [english]).id, "open");
  assert.equal(matchCommand("stop reading", [english]).id, "stopReading");
  assert.equal(matchCommand("help", [amharic, english]).id, "help");
  assert.equal(matchCommand("ረዳቱን ክፈት", [amharic, english]).id, "open");
});

test("section and language commands keep the words that follow", function () {
  const section = matchCommand("go to section Shaping the future", [english]);
  assert.equal(section.id, "goToSection");
  assert.equal(section.arg, "shaping the future");
  assert.equal(matchCommand("go to the top", [english]).id, "scrollTop");
  const lang = matchCommand("change language to Amharic", [english]);
  assert.equal(lang.id, "changeLanguage");
  assert.equal(lang.arg, "amharic");
});

test("unknown speech does not invent a command", function () {
  assert.equal(matchCommand("what is a virtual assistant", [english, amharic]), null);
  assert.equal(matchCommand("I will open the door later", [english]), null);
  assert.equal(matchCommand("   ", [english]), null);
});

const loose = {
  open: ["open assistant", "open the assistant"],
  close: ["close assistant"],
  openA11y: ["open accessibility", "accessibility tools"],
  readPage: ["read this page"],
  stopReading: ["stop reading"],
  scrollDown: ["scroll down"],
  scrollUp: ["scroll up"],
  goToSection: ["go to section"],
  textBigger: ["make text bigger", "bigger text"],
  contrastOn: ["high contrast on"],
  contrastOff: ["high contrast off"],
  cursorOn: ["big cursor", "large cursor", "cursor on"],
  cursorOff: ["small cursor", "normal cursor", "cursor off"],
  shareScreen: ["share my screen", "share screen"],
  stopSharing: ["stop sharing", "stop share"],
  changeLanguage: ["change language to"],
  suggestLanguage: ["suggest a language", "language for my area"],
};

test("part of a command is enough, and the first command listed wins a tie", function () {
  assert.equal(matchCommand("open", [loose]).id, "open");
  assert.equal(matchCommand("open a", [loose]).id, "open");
  assert.equal(matchCommand("please open the assistant", [loose]).id, "open");
  assert.equal(matchCommand("open acc", [loose]).id, "openA11y");
  assert.equal(matchCommand("accessibility", [loose]).id, "openA11y");
  assert.equal(matchCommand("stop", [loose]).id, "stopReading");
  assert.equal(matchCommand("scroll", [loose]).id, "scrollDown");
  assert.equal(matchCommand("bigger", [loose]).id, "textBigger");
  assert.equal(matchCommand("contrast", [loose]).id, "contrastOn");
  assert.equal(matchCommand("contrast off", [loose]).id, "contrastOff");
  assert.equal(matchCommand("cursor off", [loose]).id, "cursorOff");
  assert.equal(matchCommand("read page", [loose]).id, "readPage");
  assert.equal(matchCommand("share", [loose]).id, "shareScreen");
  assert.equal(matchCommand("stop share screen", [loose]).id, "stopSharing");
});

test("small mishearings still match", function () {
  assert.equal(matchCommand("open assistent", [loose]).id, "open");
  assert.equal(matchCommand("scrol down", [loose]).id, "scrollDown");
});

test("weak words alone do nothing", function () {
  assert.equal(matchCommand("text", [loose]), null);
  assert.equal(matchCommand("on", [loose]), null);
});

test("section and language commands work without every word", function () {
  const section = matchCommand("section shaping the future", [loose]);
  assert.equal(section.id, "goToSection");
  assert.equal(section.arg, "shaping the future");
  const lang = matchCommand("language to amharic", [loose]);
  assert.equal(lang.id, "changeLanguage");
  assert.equal(lang.arg, "amharic");
  assert.equal(matchCommand("language for area", [loose]).id, "suggestLanguage");
  assert.equal(matchCommand("what languages do you speak", [loose]), null);
});

test("headings match when the words are close", function () {
  const headings = ["Welcome", "Shaping the future of VA work", "Quiz"];
  assert.equal(matchHeading("shaping the future", headings), 1);
  assert.equal(matchHeading("quiz", headings), 2);
  assert.equal(matchHeading("quantum pottery", headings), -1);
});

test("language names match English and the selected language", function () {
  const code = matchLanguage("amharic", [
    { en: "እንግሊዝኛ", am: "አማርኛ" },
    { en: "English", am: "Amharic", om: "Oromo" },
    { am: "አማርኛ", om: "Afaan Oromoo" },
  ]);
  assert.equal(code, "am");
  assert.equal(matchLanguage("Afaan Oromoo", [{ om: "Afaan Oromoo" }]), "om");
  assert.equal(matchLanguage("french", [{ en: "English" }]), "");
});

test("long text is split under the limit", function () {
  const parts = chunkText("One sentence. " + "word ".repeat(800), 100);
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(part.length <= 100);
  assert.equal(chunkText("  short text  ", 100)[0], "short text");
});
