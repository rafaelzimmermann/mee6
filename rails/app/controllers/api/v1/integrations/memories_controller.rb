module Api::V1::Integrations
  class MemoriesController < ApplicationController
    before_action :set_memory, only: [:show, :destroy, :entries]

    def index
      @memories = Memory.all.order(:label)
      render json: MemorySerializer.render(@memories)
    end

    def show
      render json: MemorySerializer.render(@memory)
    end

    def create
      @memory = Memory.new(memory_params)
      if @memory.save
        render json: MemorySerializer.render(@memory), status: :created
      else
        render json: { errors: @memory.errors.full_messages }, status: :unprocessable_entity
      end
    end

    def destroy
      @memory.destroy!
      head :no_content
    end

    def entries
      n = (params[:n] || 20).to_i.clamp(1, 500)
      entries = @memory.memory_entries.order(created_at: :desc).limit(n)
      render json: MemoryEntrySerializer.render(entries)
    end

    private

    def set_memory
      @memory = Memory.find_by!(label: params[:label])
    end

    def memory_params
      params.require(:memory).permit(:label, :max_memories, :ttl_hours, :max_value_size)
    end
  end
end
