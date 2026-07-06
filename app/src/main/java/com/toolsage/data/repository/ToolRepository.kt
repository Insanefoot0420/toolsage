package com.toolsage.data.repository

import com.toolsage.data.model.*
import com.toolsage.data.remote.ApiService
import com.toolsage.data.remote.AiChatRequest
import com.toolsage.data.remote.SmartImportRequest
import com.toolsage.data.remote.SmartImportResponse
import com.toolsage.data.remote.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Repository layer for ToolSage API calls.
 * Handles API communication with the backend server.
 */
class ToolRepository {

    private val api: ApiService = HttpClient.apiService

    // ─── Tools ────────────────────────────────────────────────
    suspend fun getTools(
        category: String? = null,
        tag: String? = null,
        search: String? = null,
        limit: Int = 50,
        offset: Int = 0
    ): Result<List<Tool>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getTools(category, tag, search, limit, offset)
            if (response.isSuccessful) {
                // Handle paginated response
                val body = response.body()
                if (body != null && body.isNotEmpty() && body.first().name.isNotEmpty()) {
                    Result.success(body)
                } else {
                    Result.success(emptyList())
                }
            } else {
                Result.failure(Exception("Chyba načítání: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTool(id: String): Result<Tool> = withContext(Dispatchers.IO) {
        try {
            val response = api.getTool(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Nástroj nenalezen: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTool(tool: Tool): Result<Tool> = withContext(Dispatchers.IO) {
        try {
            val response = api.createTool(tool)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Chyba vytváření: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateTool(id: String, tool: Tool): Result<Tool> = withContext(Dispatchers.IO) {
        try {
            val response = api.updateTool(id, tool)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Chyba aktualizace: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTool(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = api.deleteTool(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Chyba mazání: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── AI Chat ──────────────────────────────────────────────
    suspend fun aiChat(message: String, history: List<com.toolsage.data.remote.ChatMessage> = emptyList()): Result<com.toolsage.data.remote.AiChatResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.aiChat(AiChatRequest(message, history))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Chyba AI: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Smart Import ─────────────────────────────────────────
    suspend fun smartImport(content: String, sourceType: String = "plain_text", fileName: String = ""): Result<SmartImportResponse> = withContext(Dispatchers.IO) {
        try {
            val response = api.smartImport(SmartImportRequest(content, sourceType, fileName))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Chyba importu: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Web Search ──────────────────────────────────────────
    suspend fun searchWeb(query: String, limit: Int = 10): Result<List<com.toolsage.data.model.WebSearchResult>> = withContext(Dispatchers.IO) {
        try {
            val response = api.searchWeb(com.toolsage.data.remote.WebSearchRequest(query, limit))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.results)
            } else {
                Result.failure(Exception("Chyba hledání: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Categories ───────────────────────────────────────────
    suspend fun getCategories(): Result<List<String>> = withContext(Dispatchers.IO) {
        try {
            val response = api.getCategories()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.map { it.name })
            } else {
                Result.success(listOf(
                    "Vývoj", "AI/ML", "Design", "DevOps", "Backend", "Frontend",
                    "Databáze", "Bezpečnost", "Cloud", "Mobilní"
                ))
            }
        } catch (e: Exception) {
            Result.success(listOf(
                "Vývoj", "AI/ML", "Design", "DevOps", "Backend", "Frontend",
                "Databáze", "Bezpečnost", "Cloud", "Mobilní"
            ))
        }
    }

    companion object {
        @Volatile
        private var instance: ToolRepository? = null

        fun getInstance(): ToolRepository {
            return instance ?: synchronized(this) {
                instance ?: ToolRepository().also { instance = it }
            }
        }
    }
}
