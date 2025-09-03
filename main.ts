import {
	App,
	Menu,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	credentials: {
		username: string;
		password: string;
	};
	notesWebhookUrl: string;
	embeddingsWebhookUrl: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	credentials: {
		username: "",
		password: "",
	},
	notesWebhookUrl: "",
	embeddingsWebhookUrl: "",
};

class NamespaceModal extends Modal {
	namespace: string;
	onSubmit: (namespace: string) => void;
	title: string;
	description: string;

	constructor(
		app: App,
		initialNamespace: string,
		onSubmit: (namespace: string) => void,
		title: string,
		description: string
	) {
		super(app);
		this.namespace = initialNamespace;
		this.onSubmit = onSubmit;
		this.title = title;
		this.description = description;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });

		new Setting(contentEl)
			.setName("Namespace")
			.setDesc(this.description)
			.addText((text) =>
				text
					.setPlaceholder("namespace")
					.setValue(this.namespace)
					.onChange((value) => {
						this.namespace = value;
					})
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Enviar")
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit(this.namespace);
				})
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		// Registrar la pestaña de settings
		this.addSettingTab(new MyPluginSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
				// Solo queremos archivos markdown
				if (file.extension === "md") {
					menu.addItem((item) => {
						item.setTitle("Generar nota mejorada")
							.setIcon("sparkles") // Puedes elegir otro icono si quieres
							.onClick(async () => {
								await this.sendMdToApi(file);
							});
					});
				}
				if (file.extension === "pdf") {
					menu.addItem((item) => {
						item.setTitle("Vectorizar")
							.setIcon("database-zap")
							.onClick(async () => {
								await this.sendPdfToApi(file);
							});
					});
				}
			})
		);
	}

	async sendMdToApi(file: TFile) {
		// Obtiene el contenido del archivo
		const fileContent = await this.app.vault.read(file);

		// Obtiene el path completo y el directorio
		const filePath = file.path;
		let dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
		dirPath = dirPath.substring(dirPath.indexOf("/") + 1);

		const dirArray = dirPath.split("/");
		const baseDir = dirArray.length > 0 ? dirArray[0] : dirPath;

		// Abrir el modal para editar el namespace
		new NamespaceModal(
			this.app,
			baseDir,
			async (namespace) => {
				// Construye el payload
				const payload = {
					fileName: file.name,
					filePath: filePath,
					dirPath: dirPath,
					content: fileContent,
					title: file.basename,
					baseDir: namespace, // Usar el valor del modal
				};

				// Envía la información a la API
				try {
					const response = await fetch(
						this.settings.notesWebhookUrl,
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization:
									"Basic " +
									btoa(
										this.settings.credentials.username +
											":" +
											this.settings.credentials.password
									),
							},
							body: JSON.stringify(payload),
						}
					);

					if (response.ok) {
						new Notice("Archivo enviado correctamente.");
					} else {
						new Notice("Error al enviar el archivo.");
					}
				} catch (error) {
					new Notice("Error de red al enviar el archivo.");
					console.error(error);
				}
			},
			"Configurar namespace de búsqueda",
			"Namespace donde se buscará información relacionada a esta nota"
		).open();
	}

	async sendPdfToApi(file: TFile) {
		try {
			// Lee el archivo como binario
			const arrayBuffer = await this.app.vault.readBinary(file);

			// Crea un blob y un FormData
			const blob = new Blob([arrayBuffer], { type: "application/pdf" });
			const formData = new FormData();
			formData.append("file", blob, file.name);

			const filePath = file.path;
			let dirPath = filePath.substring(0, filePath.lastIndexOf("/"));

			// Cortamos el primer path, ya que siempre sera el nombre del repo
			dirPath = dirPath.substring(dirPath.indexOf("/") + 1);

			// pnbtenemos el directorio base. Por ejemplo nlp/clase Dos, debe ser nlp
			const dirArray = dirPath.split("/");
			let baseDir = "";
			if (dirArray.length > 0) {
				baseDir = dirArray[0];
			} else {
				baseDir = dirPath;
			}
			formData.append("baseDir", baseDir);

			new NamespaceModal(
				this.app,
				baseDir,
				async (namespace) => {
					try {
						const arrayBuffer = await this.app.vault.readBinary(
							file
						);
						const blob = new Blob([arrayBuffer], {
							type: "application/pdf",
						});
						const formData = new FormData();
						formData.append("file", blob, file.name);
						formData.append("baseDir", namespace); // Usar el valor del modal

						const response = await fetch(
							this.settings.embeddingsWebhookUrl,
							{
								method: "POST",
								headers: {
									Authorization:
										"Basic " +
										btoa(
											this.settings.credentials.username +
												":" +
												this.settings.credentials
													.password
										),
								},
								body: formData,
							}
						);

						if (response.ok) {
							new Notice("PDF enviado a n8n correctamente.");
						} else {
							new Notice("Error al enviar el PDF a n8n.");
						}
					} catch (error) {
						new Notice("Error de red al enviar el PDF a n8n.");
						console.error(error);
					}
				},
				"Configurar namespace (Pinecone)",
				"El namespace donde se guardará el PDF en Pinecone"
			).open();
		} catch (error) {
			new Notice("Error de red al enviar el PDF a n8n.");
			console.error(error);
		}
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Configuración de credenciales" });

		new Setting(containerEl)
			.setName("Usuario")
			.setDesc("Usuario para autenticación")
			.addText((text) =>
				text
					.setPlaceholder("usuario")
					.setValue(this.plugin.settings.credentials.username)
					.onChange(async (value) => {
						this.plugin.settings.credentials.username = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Contraseña")
			.setDesc("Contraseña para autenticación")
			.addText(
				(text) =>
					text
						.setPlaceholder("contraseña")
						.setValue(this.plugin.settings.credentials.password)
						.onChange(async (value) => {
							this.plugin.settings.credentials.password = value;
							await this.plugin.saveSettings();
						})
						.inputEl.setAttribute("type", "password") // Oculta el texto
			);

		new Setting(containerEl)
			.setName("URL de la API")
			.setDesc("URL de la API")
			.addText((text) =>
				text
					.setPlaceholder("url")
					.setValue(this.plugin.settings.notesWebhookUrl)
					.onChange(async (value) => {
						this.plugin.settings.notesWebhookUrl = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("URL de la API de embeddings")
			.setDesc("URL de la API de embeddings")
			.addText((text) =>
				text
					.setPlaceholder("url")
					.setValue(this.plugin.settings.embeddingsWebhookUrl)
					.onChange(async (value) => {
						this.plugin.settings.embeddingsWebhookUrl = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
