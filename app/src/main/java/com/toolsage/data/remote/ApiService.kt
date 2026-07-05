package com.toolsage.data.remote

import com.toolsage.data.model.*
import retrofit2.Response
import retrofit2.http.*

/**
 * ToolSage REST API service interface
 * Base URL: https://toolsage-backend.onrender.com/
 */
interface ApiService {

    // ─── Tools ──────────────────────────────────────────────────────

    @GET("tools")
    suspend fun getTools(
        @Query("category") category: String? = null,
        @Query("tag") tag: String? = null,
        @Query("search") search: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0,
        @Query("sort_by") sortBy: String? = null,
        @Query("order") order: String? = null
    ): Response<List<Tool>>

    @GET("tools/{id}")
    suspend fun getTool(@Path("id") id: String): Response<Tool>

    @POST("tools")
    suspend fun createTool(@Body tool: Tool): Response<Tool>

    @PUT("tools/{id}")
    suspend fun updateTool(@Path("id") id: String, @Body tool: Tool): Response<Tool>

    @PATCH("tools/{id}")
    suspend fun patchTool(@Path("id") id: String, @Body updates: Map<String, Any>): Response<Tool>

    @DELETE("tools/{id}")
    suspend fun deleteTool(@Path("id") id: String): Response<Unit>

    @POST("tools/smart-import")
    suspend fun smartImport(@Body request: SmartImportRequest): Response<SmartImportResponse>

    // ─── AI Chat ────────────────────────────────────────────────────

    @POST("ai/chat")
    suspend fun aiChat(@Body request: AiChatRequest): Response<AiChatResponse>

    // ─── Users ──────────────────────────────────────────────────────

    @GET("users/{id}")
    suspend fun getUser(@Path("id") id: String): Response<User>

    // ─── Agents ─────────────────────────────────────────────────────

    @GET("agents/{id}")
    suspend fun getAgent(@Path("id") id: String): Response<Agent>

    @POST("agents")
    suspend fun createAgent(@Body agent: Agent): Response<Agent>

    @DELETE("agents/{id}")
    suspend fun deleteAgent(@Path("id") id: String): Response<Unit>

    @POST("agents/{id}/generate-api-key")
    suspend fun generateApiKey(@Path("id") id: String): Response<Map<String, String>>

    @DELETE("agents/{id}/revoke-api-key")
    suspend fun revokeApiKey(@Path("id") id: String): Response<Unit>

    // ─── Categories ─────────────────────────────────────────────────

    @GET("categories")
    suspend fun getCategories(): Response<List<String>>
}

/**
 * Request body for AI chat endpoint
 */
data class AiChatRequest(
    val message: String,
    val conversationHistory: List<ChatMessage> = emptyList()
)

data class ChatMessage(
    val role: String,  // "user" or "assistant"
    val content: String
)

data class AiChatResponse(
    val reply: String,
    val suggestedTools: List<String> = emptyList()  // Tool IDs
)

data class SmartImportRequest(
    val content: String,
    val sourceType: String = "plain_text",
    val fileName: String = ""
) {
    data class ToolSuggestion(
        val tool: Tool,
        val confidenceScore: Double = 0.0,
        val sourceContext: String = ""
    )
}

data class SmartImportResponse(
    val suggestions: List<SmartImportRequest.ToolSuggestion> = emptyList()
)
