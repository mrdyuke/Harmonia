import styleBtn from "./Button.module.scss";
export default (buttonText, buttonId) => `
<button id="${buttonId}" class="${styleBtn.root}">
${buttonText}
</button>
`;
