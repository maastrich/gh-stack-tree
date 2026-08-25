import { tokenItem } from "@/lib/storage";

const input = document.getElementById("token") as HTMLInputElement;
const status = document.getElementById("status")!;

tokenItem.getValue().then((v) => (input.value = v));

document.getElementById("save")!.addEventListener("click", async () => {
  await tokenItem.setValue(input.value.trim());
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1500);
});
