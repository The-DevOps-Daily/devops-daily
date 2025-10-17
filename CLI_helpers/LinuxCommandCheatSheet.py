# Simple Linux Command Cheat Sheet CLI in Python

commands = {
    "ls": "List directory contents",
    "cd": "Change the current directory",
    "pwd": "Print working directory",
    "mkdir": "Create a new directory",
    "rm": "Remove files or directories",
    "cp": "Copy files or directories",
    "mv": "Move or rename files or directories",
    "grep": "Search text using patterns",
    "chmod": "Change file permissions",
    "chown": "Change file owner and group",
    "echo": "Display message on screen",
    "cat": "Concatenate and display files",
}

def show_commands():
    print("\nAvailable commands:")
    for cmd in sorted(commands.keys()):
        print(f" - {cmd}")
    print("Type 'exit' to quit.")

def main():
    print("Linux Command Cheat Sheet CLI")
    show_commands()

    while True:
        cmd = input("\nEnter a Linux command to get its description: ").strip()
        if cmd == "exit":
            print("Goodbye!")
            break
        elif cmd in commands:
            print(f"{cmd}: {commands[cmd]}")
        else:
            print("Command not found. Try again or type 'exit'.")

if __name__ == "__main__":
    main()
