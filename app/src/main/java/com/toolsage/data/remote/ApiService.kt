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

    // ─── Agents (Agent Hub) ──────────────────────────────────────────

    @GET("agents")
    suspend fun getAgents(): Response<AgentListResponse>

    @GET("agents/{id}")
    suspend fun getAgent(@Path("id") id: String): Response<Agent>

    @POST("agents")
    suspend fun createAgent(@Body request: CreateAgentRequest): Response<Agent>

    @PUT("agents/{id}")
    suspend fun updateAgent(@Path("id") id: String, @Body body: Map<String, @JvmSuppressWildcards Any>): Response<Agent>

    @DELETE("agents/{id}")
    suspend fun deleteAgent(@Path("id") id: String): Response<Unit>

    @POST("agents/{id}/generate-key")
    suspend fun generateAgentKey(@Path("id") id: String): Response<ApiKeyResponse>

    @DELETE("agents/{id}/revoke-key")
    suspend fun revokeAgentKey(@Path("id") id: String): Response<Unit>

    @PUT("agents/{id}/permissions")
    suspend fun updateAgentPermissions(
        @Path("id") id: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<Agent>

    @PUT("agents/{id}/webhook")
    suspend fun updateAgentWebhook(
        @Path("id") id: String,
        @Body body: Map<String, String>
    ): Response<Agent>

    // Agent activity

    @GET("agents/activity")
    suspend fun getAgentActivity(
        @Query("limit") limit: Int = 30,
        @Query("agent_id") agentId: String? = null
    ): Response<AgentActivityResponse>

    @GET("agents/{id}/activity")
    suspend fun getAgentDetailActivity(
        @Path("id") id: String,
        @Query("limit") limit: Int = 20
    ): Response<AgentActivityResponse>

    // ─── Categories (full CRUD) ─────────────────────────────────────

    @GET("categories")
    suspend fun getCategories(): Response<List<Category>>

    @GET("categories/simple")
    suspend fun getCategoryNames(): Response<List<String>>

    @POST("categories")
    suspend fun createCategory(@Body request: CreateCategoryRequest): Response<Category>

    @PUT("categories/{name}")
    suspend fun updateCategory(
        @Path("name") name: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<Category>

    @DELETE("categories/{name}")
    suspend fun deleteCategory(
        @Path("name") name: String,
        @Query("reassign_to") reassignTo: String? = null
    ): Response<Unit>

    @PUT("categories/reorder")
    suspend fun reorderCategories(@Body body: ReorderCategoriesRequest): Response<List<Category>>

    // ─── Tool Export ────────────────────────────────────────────────

    @GET("tools/{id}/export")
    @Streaming
    suspend fun exportTool(
        @Path("id") id: String,
        @Query("format") format: String = "txt"
    ): Response<okhttp3.ResponseBody>

    // ─── Send Tool to Agent ─────────────────────────────────────────

    @POST("tools/{id}/send-to-agent")
    suspend fun sendToolToAgent(
        @Path("id") id: String,
        @Body request: SendToAgentRequest
    ): Response<SendToAgentResponse>

    // ─── AI Lookup ──────────────────────────────────────────────────

    @POST("ai/lookup-tool")
    suspend fun lookupTool(@Body request: ToolLookupRequest): Response<ToolLookupResponse>

    // ─── Web Search ──────────────────────────────────────────────────

    @POST("ai/search")
    suspend fun searchWeb(@Body request: WebSearchRequest): Response<WebSearchResponse>
}

data class WebSearchRequest(
    val query: String,
    val limit: Int = 10
)

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
