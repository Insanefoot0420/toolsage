package com.toolsage.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.toolsage.data.model.Tool
import com.toolsage.data.repository.ToolRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Shared ViewModel for ToolSage screens.
 * Spravuje stav aplikace a komunikaci s backendem.
 */
class ToolSageViewModel : ViewModel() {

    private val repository = ToolRepository.getInstance()

    // ─── Tools state ──────────────────────────────────────────
    private val _tools = MutableStateFlow<List<Tool>>(emptyList())
    val tools: StateFlow<List<Tool>> = _tools.asStateFlow()

    private val _selectedTool = MutableStateFlow<Tool?>(null)
    val selectedTool: StateFlow<Tool?> = _selectedTool.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // ─── Categories ───────────────────────────────────────────
    private val _categories = MutableStateFlow<List<String>>(emptyList())
    val categories: StateFlow<List<String>> = _categories.asStateFlow()

    // ─── AI Chat state ────────────────────────────────────────
    private val _aiMessages = MutableStateFlow<List<com.toolsage.data.remote.ChatMessage>>(
        listOf(com.toolsage.data.remote.ChatMessage("assistant", "👋 Ahoj! Jsem AI asistent ToolSage. Jak ti mohu pomoci?"))
    )
    val aiMessages: StateFlow<List<com.toolsage.data.remote.ChatMessage>> = _aiMessages.asStateFlow()

    private val _isAiLoading = MutableStateFlow(false)
    val isAiLoading: StateFlow<Boolean> = _isAiLoading.asStateFlow()

    // ─── Smart Import state ───────────────────────────────────
    private val _importedTools = MutableStateFlow<List<ImportedTool>>(emptyList())
    val importedTools: StateFlow<List<ImportedTool>> = _importedTools.asStateFlow()

    data class ImportedTool(
        val tool: Tool,
        val confidenceScore: Double,
        val sourceContext: String,
        val accepted: Boolean = true
    )

    init {
        loadCategories()
        loadTools()
    }

    // ─── Load functions ───────────────────────────────────────

    fun loadTools(category: String? = null, search: String? = null) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getTools(category = category, search = search)
                .onSuccess { _tools.value = it }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun loadToolDetail(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getTool(id)
                .onSuccess { _selectedTool.value = it }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun loadCategories() {
        viewModelScope.launch {
            repository.getCategories()
                .onSuccess { _categories.value = it }
        }
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    // ─── Tool CRUD ────────────────────────────────────────────

    fun createTool(tool: Tool, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.createTool(tool)
                .onSuccess {
                    loadTools()
                    onSuccess()
                }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun deleteTool(id: String) {
        viewModelScope.launch {
            repository.deleteTool(id)
                .onSuccess { loadTools() }
                .onFailure { _error.value = it.message }
        }
    }

    // ─── AI Chat ──────────────────────────────────────────────

    fun sendAiMessage(text: String) {
        viewModelScope.launch {
            val userMsg = com.toolsage.data.remote.ChatMessage("user", text)
            _aiMessages.value = _aiMessages.value + userMsg
            _isAiLoading.value = true

            repository.aiChat(text, _aiMessages.value)
                .onSuccess {
                    val aiMsg = com.toolsage.data.remote.ChatMessage("assistant", it.reply)
                    _aiMessages.value = _aiMessages.value + aiMsg
                }
                .onFailure {
                    val errorMsg = com.toolsage.data.remote.ChatMessage(
                        "assistant",
                        "Omlouvám se, momentálně nemám spojení s backendem. Odpovídám offline.\n\n" +
                        generateOfflineResponse(text)
                    )
                    _aiMessages.value = _aiMessages.value + errorMsg
                }
            _isAiLoading.value = false
        }
    }

    private fun generateOfflineResponse(query: String): String {
        val q = query.lowercase()
        return when {
            q.contains("doporuč") || q.contains("nejlepší") ->
                "Na základě databáze mám tyto nástroje:\n" +
                "1. **Android Studio** - Oficiální IDE pro vývoj Android aplikací ⭐4.5\n" +
                "2. **Firebase** - Backendová platforma od Googlu ⭐4.2\n" +
                "3. **Figma** - Nástroj pro UI/UX design ⭐4.6"
            else -> "Rozumím! Momentálně zpracovávám požadavek. Prosím zkuste to znovu, až bude backend připojený."
        }
    }

    // ─── Smart Import ─────────────────────────────────────────

    fun runSmartImport(content: String, sourceType: String = "plain_text") {
        viewModelScope.launch {
            _isLoading.value = true
            repository.smartImport(content, sourceType)
                .onSuccess { response ->
                    _importedTools.value = response.suggestions.map { suggestion ->
                        ImportedTool(
                            tool = suggestion.tool,
                            confidenceScore = suggestion.confidenceScore,
                            sourceContext = suggestion.sourceContext
                        )
                    }
                }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun toggleImportAcceptance(index: Int) {
        val current = _importedTools.value.toMutableList()
        if (index in current.indices) {
            current[index] = current[index].copy(accepted = !current[index].accepted)
            _importedTools.value = current
        }
    }

    fun saveAcceptedImports(onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            val accepted = _importedTools.value.filter { it.accepted }
            for (item in accepted) {
                repository.createTool(item.tool.copy(status = "published"))
            }
            _importedTools.value = emptyList()
            loadTools()
            onComplete()
        }
    }
}
